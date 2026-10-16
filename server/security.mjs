import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const scryptAsync = promisify(scrypt);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [salt, key] = stored.split(":");
  const candidate = await scryptAsync(password, salt, 64);
  return timingSafeEqual(Buffer.from(key, "hex"), candidate);
}
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export const safeEqual = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createVault(options = {}) {
  let key = process.env.SETTINGS_ENCRYPTION_KEY;
  if (key && !/^[a-f\d]{64}$/i.test(key))
    throw new Error("SETTINGS_ENCRYPTION_KEY must be 64 hex characters");
  if (!key) {
    const file = resolve(
      options.dataDir || process.env.YIFAN_DATA_DIR || "./data",
      "settings.key",
    );
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file))
      writeFileSync(file, randomBytes(32).toString("hex"), {
        mode: 0o600,
        flag: "wx",
      });
    key = readFileSync(file, "utf8").trim();
  }
  const bytes = Buffer.from(key, "hex");
  return {
    fingerprint(value) {
      return createHmac('sha256', bytes).update('yifan:post-fingerprint:v1:').update(value).digest('hex');
    },
    encrypt(value) {
      if (!value) return "";
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", bytes, iv);
      const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return [iv, cipher.getAuthTag(), encrypted]
        .map((b) => b.toString("hex"))
        .join(".");
    },
    decrypt(value) {
      if (!value) return "";
      const [iv, tag, body] = value
        .split(".")
        .map((s) => Buffer.from(s, "hex"));
      const decipher = createDecipheriv("aes-256-gcm", bytes, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString(
        "utf8",
      );
    },
  };
}

// Epay's legacy submit.php protocol explicitly requires MD5.
export function signEpay(params, secret) {
  const source = Object.keys(params)
    .filter(
      (k) =>
        k !== "sign" &&
        k !== "sign_type" &&
        params[k] !== "" &&
        params[k] != null,
    )
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("md5")
    .update(source + secret, "utf8")
    .digest("hex");
}
export function moneyToCents(value) {
  if (typeof value !== "string" || !/^\d{1,8}(\.\d{1,2})?$/.test(value))
    return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
