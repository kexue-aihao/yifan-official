import mysql from "mysql2/promise";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { seedDatabase } from "./seeds.mjs";

export const id = () => randomUUID();
export async function openDatabase(config) {
  if (!config || typeof config !== "object")
    throw new Error(
      "MySQL connection configuration is required; visit /install",
    );
  const pool = mysql.createPool({
    ...config,
    charset: "utf8mb4",
    connectionLimit: 10,
    connectTimeout: 8000,
    multipleStatements: false,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
  const context = new AsyncLocalStorage();
  const query = async (sql, args = []) => {
    const [rows] = await (context.getStore() || pool).query(sql, args);
    return rows;
  };
  const db = {
    pool,
    context,
    query,
    prepare(sql) {
      return {
        get: async (...args) => (await query(sql, args))[0],
        all: async (...args) => query(sql, args),
        run: async (...args) => {
          const r = await query(sql, args);
          return { ...r, changes: r.affectedRows };
        },
      };
    },
    exec: (sql) => query(sql),
    close: () => pool.end(),
  };
  try {
    await query("SELECT 1");
  } catch (e) {
    await pool.end();
    throw e;
  }
  return db;
}
export async function initializeDatabase(db) {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.exec(statement);
  await seedDatabase(db);
  await migrateReadReceipts(db);
}
// Additive upgrade for installed sites; never recreate business data or infer
// historical reads. A connection-scoped lock serializes concurrent startups.
export async function migrateReadReceipts(db) {
  const connection = await db.pool.getConnection();
  let lockName;
  try {
    const [[row]] = await connection.query(
      "SELECT CONCAT('yifan-receipts:', LEFT(SHA2(DATABASE(),256),40)) AS name",
    );
    lockName = row.name;
    const [[lock]] = await connection.query("SELECT GET_LOCK(?,15) AS acquired", [lockName]);
    if (lock.acquired !== 1) throw new Error("Could not acquire read receipt schema lock");
    const sql = await readFile(new URL("./read-receipts.sql", import.meta.url), "utf8");
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean))
      await connection.query(statement);
  } finally {
    if (lockName) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    connection.release();
  }
}
export async function transaction(db, fn) {
  if (db.context.getStore()) return fn();
  const connection = await db.pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();
    // A consistent mutex serializes capacity/payment transitions across all app processes.
    await connection.query("SELECT id FROM system_mutex WHERE id=1 FOR UPDATE");
    const result = await db.context.run(connection, fn);
    await connection.commit();
    return result;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}
export async function maintenance(db, now = Date.now()) {
  await transaction(db, async () => {
    await db
      .prepare(
        "UPDATE bookings SET status='expired' WHERE status='pending' AND expires_at<=?",
      )
      .run(now);
    await db
      .prepare("DELETE FROM messages WHERE created_at<=?")
      .run(now - 180 * 86400000);
    await db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
  });
}
