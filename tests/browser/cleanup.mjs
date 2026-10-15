import mysql from "mysql2/promise";
import { readFileSync, existsSync, unlinkSync, rmSync } from "node:fs";
import { dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { testConnection } from "../mysql-fixture.mjs";

// Playwright force-terminates server trees on Windows; clean test fixtures first.
export default async function cleanup() {
  const file = resolve("artifacts/ui-fixture.json");
  if (!existsSync(file)) return;
  const fixture = JSON.parse(readFileSync(file, "utf8"));
  const database = fixture.connection.database;
  if (!/^yf_test_[a-f0-9]{16}$/.test(database))
    throw new Error("Refusing to clean an unexpected database");
  const control = await mysql.createConnection(testConnection);
  try {
    await control.query(`DROP DATABASE IF EXISTS \`${database}\``);
  } finally {
    await control.end();
  }
  const directory = resolve(fixture.directory);
  if (
    dirname(directory).toLowerCase() !== resolve(tmpdir()).toLowerCase() ||
    !basename(directory).startsWith("yifan-ui-")
  )
    throw new Error("Unexpected test directory");
  rmSync(directory, { recursive: true, force: true });
  unlinkSync(file);
}
