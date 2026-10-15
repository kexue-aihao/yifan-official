import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createRuntime } from "../server/install.mjs";
import { createTestDatabase } from "./mysql-fixture.mjs";
import { verifyPassword, createVault } from "../server/security.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("MySQL 安装：真实连接核实、权限、令牌、安装锁及重启持久化", async (t) => {
  process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const fixture = await createTestDatabase({ initialize: false });
  const directory = mkdtempSync(join(tmpdir(), "yifan-install-"));
  const origin = "http://install.yifan.test";
  let instance = await createRuntime({
    dataDir: directory,
    origin,
    testing: true,
  });
  let server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  let base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "",
    csrf = "",
    verificationToken = "";
  const conn = { ...fixture.config, tls: false };
  let scopedUser;
  const admin = {
    siteOrigin: origin,
    adminName: "主理人",
    adminEmail: "owner@example.com",
    adminPassword: "IndependentAdmin123!",
  };
  async function request(path, body, extra = {}) {
    const r = await fetch(`${base}/api/install/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin,
        "content-type": "application/json",
        cookie,
        "x-install-csrf": csrf,
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await r.json();
    const setCookie = r.headers.getSetCookie()[0];
    if (setCookie) cookie = setCookie.split(";")[0];
    if (data.csrf) csrf = data.csrf;
    return { status: r.status, data };
  }
  async function stop() {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await instance.close();
  }
  t.after(async () => {
    await stop();
    if (scopedUser)
      await fixture.control.query(`DROP USER IF EXISTS '${scopedUser}'@'%'`);
    await fixture.cleanup();
    rmSync(directory, { recursive: true, force: true });
  });
  await t.test(
    "未配置仍可打开安装接口，业务 API 被关闭，安装密钥不可越过",
    async () => {
      assert.equal((await request("status")).data.installed, false);
      assert.equal((await fetch(`${base}/api/services`)).status, 503);
      assert.equal((await request("verify", conn)).status, 401);
      assert.equal((await request("session", { key: "wrong" })).status, 403);
      const key = readFileSync(join(directory, "install.key"), "utf8");
      assert.equal(
        (await request("session", { key }, { origin: "http://untrusted.test" }))
          .status,
        403,
      );
      assert.equal((await request("session", { key })).status, 200);
      assert.equal(
        (
          await request("complete", {
            ...admin,
            verificationToken: "not-verified",
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "不存在数据库、错误密码、非空库及缺少写权限均无法进入下一步",
    async () => {
      const missing = await request("verify", {
        ...conn,
        database: "yf_missing_" + randomBytes(6).toString("hex"),
      });
      assert.equal(missing.status, 400);
      assert.match(missing.data.error, /不存在/);
      assert.equal(
        (await request("verify", { ...conn, password: "intentionally-wrong" }))
          .status,
        400,
      );
      await fixture.db.exec("CREATE TABLE unrelated (id INT)");
      assert.equal((await request("verify", conn)).status, 409);
      await fixture.db.exec("DROP TABLE unrelated");
      const readonly = "yf_ro_" + randomBytes(6).toString("hex");
      await fixture.control.query(
        `CREATE USER '${readonly}'@'%' IDENTIFIED BY 'ReadonlyTest123!'`,
      );
      try {
        await fixture.control.query(
          `GRANT SELECT ON \`${conn.database}\`.* TO '${readonly}'@'%'`,
        );
        const r = await request("verify", {
          ...conn,
          user: readonly,
          password: "ReadonlyTest123!",
        });
        assert.equal(r.status, 400);
        assert.match(r.data.error, /权限/);
      } finally {
        await fixture.control.query(`DROP USER '${readonly}'@'%'`);
      }
    },
  );
  await t.test(
    "专用账号缺少 REFERENCES 时拒绝核实，补齐后可完成后续安装",
    async () => {
      scopedUser = 'yf_scoped_' + randomBytes(6).toString('hex');
      const password = 'ScopedInstall123!';
      await fixture.control.query(
        `CREATE USER '${scopedUser}'@'%' IDENTIFIED BY ?`, [password],
      );
      await fixture.control.query(
        `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,DROP ON \`${conn.database}\`.* TO '${scopedUser}'@'%'`,
      );
      const scoped = {...conn, user: scopedUser, password};
      const denied = await request('verify', scoped);
      assert.equal(denied.status, 400);
      assert.match(denied.data.error, /REFERENCES/);
      assert.equal(denied.data.verificationToken, undefined);
      assert.equal((await fixture.db.prepare('SHOW TABLES').all()).length, 0);
      await fixture.control.query(
        `GRANT REFERENCES ON \`${conn.database}\`.* TO '${scopedUser}'@'%'`,
      );
      const allowed = await request('verify', scoped);
      assert.equal(allowed.status, 200, JSON.stringify(allowed.data));
      assert.equal((await fixture.db.prepare('SHOW TABLES').all()).length, 0);
      // Complete the rest of the real installer with this scoped account.
      Object.assign(conn, scoped);
    },
  );
  await t.test(
    "真实 DDL/DML 验证通过才发放令牌，修改参数后旧令牌作废",
    async () => {
      const r = await request("verify", conn);
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.database, conn.database);
      assert.equal(r.data.charset, "utf8mb4");
      assert.equal(r.data.permissions, true);
      verificationToken = r.data.verificationToken;
      assert.equal((await fixture.db.prepare("SHOW TABLES").all()).length, 0);
      await request("verify", { ...conn, database: "yf_no_such_db" });
      assert.equal(
        (await request("complete", { ...admin, verificationToken })).status,
        409,
      );
      verificationToken = (await request("verify", conn)).data
        .verificationToken;
      assert.equal(
        (
          await request("complete", {
            ...admin,
            siteOrigin: "http://wrong.test",
            verificationToken,
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "完成时再次核实数据库，安装创建管理员及表并加密保存连接参数",
    async () => {
      await fixture.db.exec("CREATE TABLE after_verify (id INT)");
      assert.equal(
        (await request("complete", { ...admin, verificationToken })).status,
        409,
      );
      await fixture.db.exec("DROP TABLE after_verify");
      const r = await request("complete", { ...admin, verificationToken });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal((await request("status")).data.installed, true);
      const owner = await fixture.db
        .prepare("SELECT * FROM users WHERE email='owner@example.com'")
        .get();
      assert.equal(owner.role, "admin");
      assert.ok(await verifyPassword(admin.adminPassword, owner.password));
      assert.equal(
        (await fixture.db.prepare("SELECT COUNT(*) AS n FROM services").get())
          .n,
        6,
      );
      const stored = readFileSync(join(directory, "installation.json"), "utf8");
      assert.ok(!stored.includes(conn.user));
      assert.ok(!stored.includes(admin.adminPassword));
      const decrypted = JSON.parse(
        createVault().decrypt(JSON.parse(stored).connection),
      );
      assert.equal(decrypted.database, conn.database);
      assert.ok(!existsSync(join(directory, "install.running")));
      assert.equal(
        (
          await request("session", {
            key: readFileSync(join(directory, "install.key"), "utf8"),
          })
        ).status,
        409,
      );
    },
  );
  await t.test("重启后安装锁继续生效，管理员可正常登录", async () => {
    await stop();
    instance = await createRuntime({
      dataDir: directory,
      origin,
      testing: true,
    });
    server = instance.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await request("status")).data.installed, true);
    assert.equal((await request("verify", conn)).status, 409);
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        email: admin.adminEmail,
        password: admin.adminPassword,
      }),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).user.role, "admin");
  });
  await t.test(
    "安装后 CLI 可添加独立管理员，不泄漏密码且拒绝已有账号",
    async () => {
      const run = promisify(execFile),
        password = "AdditionalAdmin123!";
      const env = {
        ...process.env,
        YIFAN_DATA_DIR: directory,
        YIFAN_ADMIN_EMAIL: "cli@example.com",
        YIFAN_ADMIN_NAME: "CLI管理员",
        YIFAN_ADMIN_PASSWORD: password,
      };
      const r = await run(process.execPath, ["scripts/create-admin.mjs"], {
        env,
        timeout: 10000,
      });
      assert.match(r.stdout, /管理员已创建/);
      assert.ok(!r.stdout.includes(password));
      const user = await fixture.db
        .prepare("SELECT * FROM users WHERE email=?")
        .get("cli@example.com");
      assert.equal(user.role, "admin");
      assert.ok(await verifyPassword(password, user.password));
      await fixture.db
        .prepare("INSERT INTO users VALUES (?,?,?,?,?,?)")
        .run(
          randomBytes(16).toString("hex"),
          "ordinary@example.com",
          "顾客",
          await import("../server/security.mjs").then((s) =>
            s.hashPassword("Customer12345!"),
          ),
          "customer",
          Date.now(),
        );
      await assert.rejects(
        run(process.execPath, ["scripts/create-admin.mjs"], {
          env: { ...env, YIFAN_ADMIN_EMAIL: "ordinary@example.com" },
          timeout: 10000,
        }),
        (e) => {
          assert.match(e.stderr, /邮箱已存在/);
          return true;
        },
      );
      assert.equal(
        (
          await fixture.db
            .prepare("SELECT role FROM users WHERE email=?")
            .get("ordinary@example.com")
        ).role,
        "customer",
      );
    },
  );
});
