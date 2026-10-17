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
  await migrateVisitors(db);
  await migrateCommunity(db);
  await migrateStaff(db);
  await migrateCustomerProfiles(db);
}
export async function migrateCustomerProfiles(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS customer_profiles (
    user_id VARCHAR(36) PRIMARY KEY, active TINYINT NOT NULL DEFAULT 1, updated_at BIGINT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
}
export async function migrateStaff(db) {
  const connection = await db.pool.getConnection();
  let lockName;
  try {
    const [[row]] = await connection.query(
      "SELECT CONCAT('yifan-staff:', LEFT(SHA2(DATABASE(),256),40)) AS name",
    );
    lockName = row.name;
    const [[lock]] = await connection.query("SELECT GET_LOCK(?,15) AS acquired", [lockName]);
    if (lock.acquired !== 1) throw new Error("Could not acquire staff schema lock");
    await connection.query(`CREATE TABLE IF NOT EXISTS staff_profiles (
      user_id VARCHAR(36) PRIMARY KEY, display_name VARCHAR(120) NOT NULL,
      title VARCHAR(80) NOT NULL DEFAULT '店铺成员', member_role VARCHAR(20) NOT NULL DEFAULT 'staff', active TINYINT NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    const [profileColumns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='staff_profiles' AND COLUMN_NAME='member_role'",
    );
    if (!profileColumns.length) {
      await connection.query("ALTER TABLE staff_profiles ADD COLUMN member_role VARCHAR(20) NOT NULL DEFAULT 'staff' AFTER title");
    }
    await connection.query(
      "UPDATE staff_profiles sp JOIN users u ON u.id=sp.user_id SET sp.member_role='owner' WHERE u.role='admin' AND sp.member_role='staff' AND sp.title IN ('店主','店铺成员')",
    );
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='conversations' AND COLUMN_NAME IN ('assignee_id','assigned_at')",
    );
    const names = new Set(columns.map((column) => column.COLUMN_NAME));
    if (!names.has("assignee_id"))
      await connection.query("ALTER TABLE conversations ADD COLUMN assignee_id VARCHAR(36) NULL AFTER booking_id");
    if (!names.has("assigned_at"))
      await connection.query("ALTER TABLE conversations ADD COLUMN assigned_at BIGINT NULL AFTER assignee_id");
    const [indexes] = await connection.query(
      "SELECT INDEX_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='conversations' AND INDEX_NAME='conversation_assignee'",
    );
    if (!indexes.length)
      await connection.query("ALTER TABLE conversations ADD INDEX conversation_assignee(assignee_id)");
    const [constraints] = await connection.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.key_column_usage WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='conversations' AND COLUMN_NAME='assignee_id' AND REFERENCED_TABLE_NAME='users'",
    );
    if (!constraints.length)
      await connection.query("ALTER TABLE conversations ADD CONSTRAINT conversation_assignee_fk FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL");
    await connection.query(
      "INSERT IGNORE INTO staff_profiles(user_id,display_name,title,member_role,active,sort_order,created_at) SELECT id,name,'店主','owner',1,0,created_at FROM users WHERE role='admin'",
    );
  } finally {
    if (lockName) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    connection.release();
  }
}
export async function migrateCommunity(db) {
  const connection = await db.pool.getConnection();
  let lockName;
  try {
    const [[row]] = await connection.query("SELECT CONCAT('yifan-community:', LEFT(SHA2(DATABASE(),256),40)) AS name");
    lockName = row.name;
    const [[lock]] = await connection.query('SELECT GET_LOCK(?,15) AS acquired',[lockName]);
    if (lock.acquired !== 1) throw new Error('Could not acquire community schema lock');
    const sql = await readFile(new URL('./community.sql', import.meta.url),'utf8');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await connection.query(statement);
    const [[column]] = await connection.query("SELECT CHARACTER_MAXIMUM_LENGTH AS size FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='services' AND COLUMN_NAME='image'");
    if (Number(column.size) < 2048) await connection.query('ALTER TABLE services MODIFY image VARCHAR(2048) NOT NULL');
    const [[views]] = await connection.query("SELECT 1 AS present FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='posts' AND COLUMN_NAME='view_count'");
    if (!views) await connection.query('ALTER TABLE posts ADD COLUMN view_count BIGINT UNSIGNED NOT NULL DEFAULT 0');
    await connection.query("INSERT IGNORE INTO settings(setting_key,value) VALUES ('media',?)", [JSON.stringify({images:{}})]);
  } finally {
    if (lockName) await connection.query('SELECT RELEASE_LOCK(?)',[lockName]).catch(() => {});
    connection.release();
  }
}
export async function migrateVisitors(db) {
  const sql = await readFile(new URL('./visitor-audit.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.exec(statement);
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
    await db.prepare('DELETE FROM visitor_events WHERE created_at<=?').run(now - 180 * 86400000);
    await db.prepare('DELETE FROM post_sources WHERE created_at<=?').run(now - 180 * 86400000);
    // Keep request deduplication for one day; lifetime totals stay on the post.
    await db.prepare('DELETE FROM post_view_events WHERE created_at<=?').run(now - 86400000);
    await db.prepare('DELETE g FROM visitor_ips g LEFT JOIN visitor_events e ON e.ip=g.ip WHERE e.id IS NULL AND g.resolved_at<=?').run(now - 180 * 86400000);
  });
}
