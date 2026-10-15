import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { openDatabase, initializeDatabase } from "../server/db.mjs";

export const testConnection = {
  host: process.env.MYSQL_TEST_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_TEST_PORT || 3317),
  user: process.env.MYSQL_TEST_USER || "root",
  password: process.env.MYSQL_TEST_PASSWORD || "",
};
export async function createTestDatabase({ initialize = true } = {}) {
  const database = `yf_test_${randomBytes(8).toString("hex")}`;
  let control;
  try {
    control = await mysql.createConnection({
      ...testConnection,
      connectTimeout: 5000,
    });
  } catch {
    throw new Error(
      "Real MySQL test instance unavailable. Configure MYSQL_TEST_HOST/PORT/USER/PASSWORD (defaults to isolated localhost:3317).",
    );
  }
  await control.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  const config = { ...testConnection, database };
  const db = await openDatabase(config);
  if (initialize) await initializeDatabase(db);
  let closed = false;
  return {
    db,
    config,
    control,
    async cleanup() {
      if (closed) return;
      closed = true;
      await db.close().catch(() => {});
      if (!/^yf_test_[a-f0-9]{16}$/.test(database))
        throw new Error("Unsafe test schema");
      await control.query(`DROP DATABASE IF EXISTS \`${database}\``);
      await control.end();
    },
  };
}
