import express from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import mysql from "mysql2/promise";
import { randomBytes, randomUUID } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { z, ZodError } from "zod";
import {
  createVault,
  tokenHash,
  safeEqual,
  hashPassword,
} from "./security.mjs";
import { openDatabase, initializeDatabase, id, transaction } from "./db.mjs";
import { createApp } from "./app.mjs";
import {configureProxy} from './visitors.mjs';
import {apiLocale, validationError} from "./i18n.mjs";

const connectionSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .refine((v) => !/[\s/\\]/.test(v), "数据库主机格式不正确"),
  port: z.coerce.number().int().min(1).max(65535),
  database: z
    .string()
    .regex(/^[a-zA-Z0-9_]{1,64}$/, "库名仅支持字母、数字和下划线"),
  user: z.string().min(1).max(80),
  password: z.string().max(256),
  tls: z.boolean().default(false),
});
const err = (status, message) => Object.assign(new Error(message), { status });
const configFor = (input) => ({
  host: input.host,
  port: input.port,
  database: input.database,
  user: input.user,
  password: input.password,
  ...(input.tls ? { ssl: { rejectUnauthorized: true } } : {}),
});
const dbError = (e) => {
  if (e.status) return e;
  const messages = {
    ER_BAD_DB_ERROR: "指定的数据库不存在，请先在 MySQL 中创建数据库。",
    ER_ACCESS_DENIED_ERROR:
      "MySQL 用户名或密码不正确，或该账号不允许从本站连接。",
    ER_DBACCESS_DENIED_ERROR: "该账号没有访问此数据库的权限。",
    ECONNREFUSED: "无法连接 MySQL，请检查主机、端口及数据库服务。",
    ETIMEDOUT: "连接 MySQL 超时，请检查网络及防火墙。",
    ER_TABLEACCESS_DENIED_ERROR:
      "数据库权限不足，需要 CREATE、ALTER、INDEX、REFERENCES、SELECT、INSERT、UPDATE、DELETE、DROP 权限。",
  };
  return err(
    400,
    messages[e.code] || "数据库校验失败，请检查数据库地址、TLS 和账号权限。",
  );
};
export async function verifyDatabase(input, owner) {
  let connection, probe, probeChild;
  try {
    connection = await mysql.createConnection({
      ...configFor(input),
      connectTimeout: 7000,
      multipleStatements: false,
    });
    const [[info]] = await connection.query(
      "SELECT DATABASE() AS db, VERSION() AS version, @@character_set_database AS charset",
    );
    if (info.db !== input.database)
      throw err(400, "实际连接的数据库与填写的库名不一致。");
    if (/mariadb/i.test(info.version) || Number(info.version.split(".")[0]) < 8)
      throw err(400, "本站需要 MySQL 8.0 或以上版本。");
    if (info.charset !== "utf8mb4")
      throw err(400, "请先将数据库字符集设置为 utf8mb4，再重新校验。");
    const [tables] = await connection.query(
      "SELECT TABLE_NAME AS name FROM information_schema.tables WHERE TABLE_SCHEMA=?",
      [input.database],
    );
    let resumable = false;
    if (tables.length) {
      if (tables.some((t) => t.name === "installation_meta")) {
        const [[meta]] = await connection.query(
          "SELECT owner,completed FROM installation_meta WHERE id=1",
        );
        resumable = !!meta && safeEqual(meta.owner, owner) && !meta.completed;
      }
      if (!resumable)
        throw err(
          409,
          "请使用预先创建的空数据库；当前数据库已有数据或已完成安装。",
        );
    }
    probe = `yf_probe_${randomBytes(8).toString("hex")}`;
    await connection.query(
      `CREATE TABLE \`${probe}\` (id INT PRIMARY KEY, value VARCHAR(20)) ENGINE=InnoDB`,
    );
    // Business tables have foreign keys: ordinary CREATE/ALTER privileges alone
    // do not prove that a scoped application account can initialize the schema.
    probeChild = `${probe}_child`;
    await connection.query(
      `CREATE TABLE \`${probeChild}\` (id INT PRIMARY KEY, parent_id INT, FOREIGN KEY (parent_id) REFERENCES \`${probe}\` (id)) ENGINE=InnoDB`,
    );
    await connection.query(
      `ALTER TABLE \`${probe}\` ADD INDEX probe_value (value)`,
    );
    await connection.query(`INSERT INTO \`${probe}\` VALUES (1,?)`, [
      "verified",
    ]);
    const [[row]] = await connection.query(
      `SELECT value FROM \`${probe}\` WHERE id=1`,
    );
    if (row?.value !== "verified") throw err(400, "数据库读写核实失败。");
    await connection.query(
      `UPDATE \`${probe}\` SET value='updated' WHERE id=1`,
    );
    await connection.query(`DELETE FROM \`${probe}\` WHERE id=1`);
    await connection.query(`DROP TABLE \`${probeChild}\``);
    probeChild = null;
    await connection.query(`DROP TABLE \`${probe}\``);
    probe = null;
    return {
      database: info.db,
      version: info.version,
      charset: info.charset,
      permissions: true,
      resumable,
    };
  } catch (e) {
    throw dbError(e);
  } finally {
    if (connection) {
      if (probeChild)
        await connection
          .query(`DROP TABLE IF EXISTS \`${probeChild}\``)
          .catch(() => {});
      if (probe)
        await connection
          .query(`DROP TABLE IF EXISTS \`${probe}\``)
          .catch(() => {});
      await connection.end();
    }
  }
}

export async function createRuntime(options = {}) {
  const dataDir = resolve(
    options.dataDir || process.env.YIFAN_DATA_DIR || "./data",
  );
  mkdirSync(dataDir, { recursive: true });
  const configFile = resolve(dataDir, "installation.json"),
    keyFile = resolve(dataDir, "install.key");
  const vault = options.vault || createVault({ dataDir });
  if (!existsSync(configFile) && !existsSync(keyFile))
    writeFileSync(keyFile, randomBytes(24).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  const installKey = existsSync(keyFile)
    ? readFileSync(keyFile, "utf8").trim()
    : "";
  const owner = tokenHash(installKey);
  let business = null,
    installed = existsSync(configFile),
    installing = false;
  const load = async () => {
    const stored = JSON.parse(readFileSync(configFile, "utf8"));
    const config = JSON.parse(vault.decrypt(stored.connection));
    const db = await openDatabase(config);
    try {
      business = await createApp({
        db,
        vault,
        origin: stored.origin,
        testing: options.testing,
      });
    } catch (e) {
      await db.close();
      throw e;
    }
  };
  // Never reopen installation when a configured database is temporarily unavailable.
  if (installed) await load();
  const app = express();
  app.use(apiLocale);
  app.disable("x-powered-by");
  configureProxy(app);
  app.use("/api/install", express.json({ limit: "16kb" }), cookieParser());
  app.use("/api/install", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const sessions = new Map();
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", installed, database: "MySQL" }),
  );
  const publicOrigin = (req) =>
    options.origin ||
    process.env.APP_ORIGIN ||
    (process.env.NODE_ENV === "production"
      ? `${req.protocol}://${req.get("host")}`
      : "http://localhost:5173");
  app.get("/api/install/status", (_req, res) =>
    res.json({
      installed,
      database: "MySQL",
      minimumVersion: "8.0",
      keyRequired: !installed,
    }),
  );
  app.use(
    "/api/install",
    rateLimit({
      windowMs: 15 * 60000,
      limit: options.testing ? 500 : 40,
      message: {error: "请求过于频繁，请稍后再试"},
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api/install", (req, _res, next) => {
    if (installed) return next(err(409, "网站已安装，安装入口已锁定。"));
    if (req.get("origin") !== publicOrigin(req))
      return next(err(403, "安装请求来源不正确，请使用站点正式域名访问。"));
    if (!["POST"].includes(req.method))
      return next(err(405, "不支持的安装操作。"));
    next();
  });
  app.post("/api/install/session", (req, res) => {
    const { key } = z.object({ key: z.string().max(200) }).parse(req.body);
    if (!safeEqual(key, installKey))
      throw err(403, "安装密钥不正确，请查看服务器 data/install.key 文件。");
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    for (const [k, s] of sessions)
      if (s.expires < Date.now()) sessions.delete(k);
    sessions.set(token, { csrf, expires: Date.now() + 30 * 60000 });
    res.cookie("yf_install", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: publicOrigin(req).startsWith("https:"),
      maxAge: 30 * 60000,
      path: "/api/install",
    });
    res.json({ csrf, expiresIn: 1800 });
  });
  app.use("/api/install", (req, _res, next) => {
    const session = sessions.get(req.cookies.yf_install);
    if (!session || session.expires < Date.now())
      return next(err(401, "安装会话已过期，请重新输入安装密钥。"));
    if (!safeEqual(session.csrf, req.get("x-install-csrf")))
      return next(err(403, "安装会话校验失败。"));
    req.setup = session;
    next();
  });
  app.post("/api/install/verify", async (req, res) => {
    req.setup.verified = null;
    const input = connectionSchema.parse(req.body);
    const result = await verifyDatabase(input, owner);
    const token = randomBytes(24).toString("hex");
    req.setup.verified = { input, token, expires: Date.now() + 10 * 60000 };
    res.json({ ...result, verificationToken: token, expiresIn: 600 });
  });
  app.post("/api/install/complete", async (req, res) => {
    const input = z
      .object({
        verificationToken: z.string(),
        siteOrigin: z.url(),
        adminName: z.string().trim().min(1).max(30),
        adminEmail: z
          .email()
          .max(160)
          .transform((s) => s.toLowerCase()),
        adminPassword: z.string().min(12).max(128),
      })
      .parse(req.body);
    const verified = req.setup.verified;
    if (
      !verified ||
      verified.expires < Date.now() ||
      !safeEqual(verified.token, input.verificationToken)
    )
      throw err(
        409,
        "请先完成数据库真实性校验；校验结果已失效或不属于当前会话。",
      );
    const url = new URL(input.siteOrigin);
    if (
      url.origin !== publicOrigin(req) ||
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw err(400, "站点地址须与当前访问域名一致，且不包含路径或查询参数。");
    if (
      !options.testing &&
      process.env.NODE_ENV === "production" &&
      url.protocol !== "https:"
    )
      throw err(400, "生产站点地址需要使用 HTTPS。");
    if (installing) throw err(409, "正在安装，请稍候。");
    installing = true;
    const fsLock = resolve(dataDir, "install.running");
    let db,
      lockConnection,
      ownsFile = false;
    try {
      try {
        writeFileSync(fsLock, String(process.pid), { flag: "wx", mode: 0o600 });
        ownsFile = true;
      } catch {
        throw err(
          409,
          "其他进程正在安装，请稍候；如服务器异常退出，请确认无安装进程后移除 data/install.running。",
        );
      }
      if (existsSync(configFile)) throw err(409, "网站已经安装。");
      await verifyDatabase(verified.input, owner);
      db = await openDatabase(configFor(verified.input));
      lockConnection = await db.pool.getConnection();
      const lockName = `yifan-install:${tokenHash(verified.input.database).slice(0, 40)}`;
      const [[lock]] = await lockConnection.query(
        "SELECT GET_LOCK(?,0) AS acquired",
        [lockName],
      );
      if (!lock.acquired) throw err(409, "该数据库正在被另一个安装进程使用。");
      await db.exec(
        "CREATE TABLE IF NOT EXISTS installation_meta (id INT PRIMARY KEY,owner VARCHAR(64) NOT NULL,completed TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB",
      );
      const metadata = await db
        .prepare("SELECT * FROM installation_meta WHERE id=1")
        .get();
      if (metadata && (!safeEqual(metadata.owner, owner) || metadata.completed))
        throw err(409, "该数据库已被其他站点使用或已安装。");
      if (!metadata)
        await db
          .prepare("INSERT INTO installation_meta VALUES (1,?,0)")
          .run(owner);
      await initializeDatabase(db);
      const password = await hashPassword(input.adminPassword);
      await transaction(db, async () => {
        const existing = await db
          .prepare("SELECT id FROM users WHERE role='admin'")
          .get();
        if (existing)
          throw err(
            409,
            "此数据库已存在管理员，请恢复安装配置文件或使用空数据库。",
          );
        const ownerId = id();
        await db
          .prepare("INSERT INTO users VALUES (?,?,?,?,?,?)")
          .run(
            ownerId,
            input.adminEmail,
            input.adminName,
            password,
            "admin",
            Date.now(),
          );
        await db
          .prepare("INSERT INTO staff_profiles(user_id,display_name,title,member_role,active,sort_order,created_at) VALUES (?,?,?,?,?,?,?)")
          .run(ownerId, input.adminName, "店主", "owner", 1, 0, Date.now());
      });
      const tmp = resolve(dataDir, `installation.${randomUUID()}.tmp`);
      try {
        writeFileSync(
          tmp,
          JSON.stringify(
            {
              version: 1,
              origin: url.origin,
              connection: vault.encrypt(
                JSON.stringify(configFor(verified.input)),
              ),
              installedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
          { mode: 0o600, flag: "wx" },
        );
        renameSync(tmp, configFile);
      } catch (e) {
        await db
          .prepare("DELETE FROM users WHERE email=? AND role='admin'")
          .run(input.adminEmail);
        if (existsSync(tmp)) unlinkSync(tmp);
        throw e;
      }
      installed = true;
      await db
        .prepare("UPDATE installation_meta SET completed=1 WHERE id=1")
        .run();
      await load();
      sessions.clear();
      res
        .clearCookie("yf_install", { path: "/api/install" })
        .status(201)
        .json({ installed: true, login: "/login?next=/admin" });
    } finally {
      if (lockConnection) {
        await lockConnection
          .query("SELECT RELEASE_ALL_LOCKS()")
          .catch(() => {});
        lockConnection.release();
      }
      if (db) await db.close();
      if (ownsFile) unlinkSync(fsLock);
      installing = false;
    }
  });
  app.use("/api/install", (_req, res) =>
    res.status(404).json({ error: "安装接口不存在" }),
  );
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    if (business) return business.app(req, res, next);
    res
      .status(503)
      .json({
        error: "请先访问 /install 完成网站安装",
        installationRequired: true,
      });
  });
  app.use((error, req, res, _next) => {
    if (error instanceof ZodError)
      return res
        .status(400)
        .json(validationError(error, req.yifanLocale));
    if (!error.status)
      console.error("Installation error:", error.code || error.message);
    res
      .status(error.status || 500)
      .json({
        error: error.status
          ? error.message
          : "安装未完成，请检查服务器日志后重试。",
      });
  });
  return {
    app,
    keyFile,
    installed: () => installed,
    close: async () => {
      sessions.clear();
      if (business) await business.close();
    },
  };
}
