import {access, readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {openDatabase} from "./db.mjs";
import {createVault} from "./security.mjs";

export const themeIds = ["ivory", "rose", "sage", "noir"];
export const normalizeTheme = value => themeIds.includes(value) ? value : "ivory";

// The server-rendered first frame uses the same saved default as the API.
// A separate, read-only pool is reused by Next.js, including during dev reloads.
const poolKey = Symbol.for("yifan.appearance.database");
async function getStoredSetting(settingKey) {
  try {
    const dataDir = resolve(/*turbopackIgnore: true*/ process.env.YIFAN_DATA_DIR || "./data");
    const stored = JSON.parse(await readFile(resolve(dataDir, "installation.json"), "utf8"));
    const identity = `${dataDir}:${stored.connection}`;
    let cached = globalThis[poolKey];
    if (!cached || cached.identity !== identity) {
      if (cached) void cached.database.then(db => db.close()).catch(() => {});
      // Rendering must never generate a replacement for a missing installation key.
      if (!process.env.SETTINGS_ENCRYPTION_KEY) await access(resolve(dataDir, "settings.key"));
      const config = JSON.parse(createVault({dataDir}).decrypt(stored.connection));
      const database = openDatabase(config);
      cached = globalThis[poolKey] = {identity, database};
      database.catch(() => {if (globalThis[poolKey] === cached) delete globalThis[poolKey];});
    }
    const db = await cached.database;
    const row = await db.prepare('SELECT value FROM settings WHERE setting_key=?').get(settingKey);
    return row ? JSON.parse(row.value) : null;
  } catch {
    // Uninstalled sites and unavailable databases still render an accessible shell.
    return null;
  }
}
export async function getDefaultTheme() {return normalizeTheme((await getStoredSetting('site'))?.defaultTheme);}
export async function getSiteImages() {return (await getStoredSetting('media'))?.images || {};}
