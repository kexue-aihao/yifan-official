import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { openDatabase, id } from "../server/db.mjs";
import { hashPassword } from "../server/security.mjs";
import { createVault } from "../server/security.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: stdin, output, terminal: !!stdin.isTTY });
let db;
try {
  const email = (
    process.env.YIFAN_ADMIN_EMAIL || (await rl.question("管理员邮箱: "))
  )
    .trim()
    .toLowerCase();
  const name = (
    process.env.YIFAN_ADMIN_NAME || (await rl.question("管理员名称: "))
  ).trim();
  // Prefer a temporary process environment value to keep a password out of command arguments.
  let password = process.env.YIFAN_ADMIN_PASSWORD;
  if (!password) {
    if (!stdin.isTTY)
      throw new Error("非交互模式需要 YIFAN_ADMIN_PASSWORD 环境变量");
    stdout.write("管理员密码（至少 12 位，输入隐藏）: ");
    muted = true;
    password = await rl.question("");
    muted = false;
    stdout.write("\n");
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name ||
    name.length > 30 ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("邮箱、名称或密码格式不正确");
  const stored = JSON.parse(
    readFileSync(
      resolve(process.env.YIFAN_DATA_DIR || "./data", "installation.json"),
      "utf8",
    ),
  );
  db = await openDatabase(JSON.parse(createVault().decrypt(stored.connection)));
  if (await db.prepare("SELECT id FROM users WHERE email=?").get(email))
    throw new Error("邮箱已存在；为避免意外提权，请使用独立管理员邮箱");
  await db
    .prepare("INSERT INTO users VALUES (?,?,?,?,?,?)")
    .run(id(), email, name, await hashPassword(password), "admin", Date.now());
  console.log("管理员已创建。请通过网站登录后访问 /admin。");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.close();
  muted = false;
  rl.close();
}
