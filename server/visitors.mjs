import ipaddr from "ipaddr.js";
import geoip from "geoip-lite";
import { randomUUID } from "node:crypto";

export const visitorCutoff = () => Date.now() - 180 * 86400000;
export function normalizeIP(value) {
  try {
    const address = ipaddr.process(value || "");
    return address.toString();
  } catch {
    return null;
  }
}
/**
 * Return the address resolved by Express' proxy-addr configuration.
 *
 * `req.ip` is the only value that may include a forwarded address. Express
 * calculates it from the socket address and X-Forwarded-For only when the
 * connecting proxy is trusted. The socket fallback keeps direct requests
 * auditable if a non-standard test adapter does not populate req.ip.
 */
export function getClientIP(req) {
  for (const candidate of [req?.ip, req?.socket?.remoteAddress]) {
    const ip = normalizeIP(candidate);
    if (ip) return ip;
  }
  return null;
}
// Only explicit, trusted proxy addresses may supply X-Forwarded-For.
// The legacy setting 1 means a local reverse proxy, never any one arbitrary hop.
export function configureProxy(app, value = process.env.TRUST_PROXY) {
  const setting = String(value ?? "").trim();
  app.set(
    "trust proxy",
    setting === "1"
      ? "loopback"
      : setting && setting !== "0"
        ? setting
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : false,
  );
}
export function locateIP(ip) {
  const address = ipaddr.parse(ip);
  if (address.range() !== "unicast")
    return {
      country: "",
      region: "",
      city: "",
      geo_status: "private",
      source: "network-range",
    };
  const place = geoip.lookup(ip);
  return place
    ? {
        country: place.country || "",
        region: place.region || "",
        city: place.city || "",
        geo_status: "located",
        source: "geoip-lite / GeoLite2",
      }
    : {
        country: "",
        region: "",
        city: "",
        geo_status: "unknown",
        source: "geoip-lite / GeoLite2",
      };
}
export function createVisitorAudit(db) {
  return async function record(req, kind, context = {}) {
    const ip = getClientIP(req);
    if (!ip) throw new Error("Cannot determine request IP");
    const now = Date.now();
    const cached = await db
      .prepare("SELECT resolved_at FROM visitor_ips WHERE ip=?")
      .get(ip);
    if (!cached || cached.resolved_at < now - 7 * 86400000) {
      const geo = locateIP(ip);
      await db
        .prepare(
          `INSERT INTO visitor_ips(ip,country,region,city,geo_status,source,resolved_at) VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE country=VALUES(country),region=VALUES(region),city=VALUES(city),geo_status=VALUES(geo_status),source=VALUES(source),resolved_at=VALUES(resolved_at)`,
        )
        .run(
          ip,
          geo.country,
          geo.region,
          geo.city,
          geo.geo_status,
          geo.source,
          now,
        );
    }
    // Caller-provided event UUID only deduplicates page delivery, never identifies a user.
    await db
      .prepare(
        `INSERT INTO visitor_events(id,user_id,ip,kind,path,booking_id,conversation_id,message_id,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        context.eventId || randomUUID(),
        req.user?.id || null,
        ip,
        kind,
        context.path || "",
        context.bookingId || null,
        context.conversationId || null,
        context.messageId || null,
        now,
      );
  };
}
export function visitorRoutes(app, db) {
  const summary = `SELECT e.ip,g.country,g.region,g.city,g.geo_status,g.source,
    COUNT(*) AS occurrence_count,SUM(e.kind='page') AS page_count,SUM(e.kind='booking') AS booking_count,
    SUM(e.kind='message') AS message_count,COUNT(DISTINCT e.user_id) AS user_count,
    MIN(e.created_at) AS first_seen,MAX(e.created_at) AS last_seen
    FROM visitor_events e LEFT JOIN visitor_ips g ON g.ip=e.ip`;
  app.get("/api/admin/visitors", async (req, res) => {
    if (req.user?.staff_member_role === "staff")
      return res.status(403).json({ error: "需要店主权限" });
    const page = Math.max(
      1,
      Math.min(10000, Number.parseInt(req.query.page, 10) || 1),
    );
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 160);
    const args = [visitorCutoff()];
    let where = " WHERE e.created_at>?";
    if (search) {
      where += ` AND (e.ip=? OR e.user_id=? OR e.user_id IN (SELECT id FROM users WHERE email=? OR name=?))`;
      args.push(search, search, search, search);
    }
    const totals = await db
      .prepare(
        `SELECT COUNT(DISTINCT e.ip) AS ips,COUNT(*) AS occurrences,
      COALESCE(SUM(e.kind='page'),0) AS pages,COUNT(DISTINCT e.user_id) AS users FROM visitor_events e${where}`,
      )
      .get(...args);
    const items = await db
      .prepare(
        `${summary}${where} GROUP BY e.ip ORDER BY last_seen DESC,e.ip LIMIT 25 OFFSET ?`,
      )
      .all(...args, (page - 1) * 25);
    res.json({ items, totals, page, pageSize: 25, retentionDays: 180 });
  });
  app.get("/api/admin/visitor-events", async (req, res) => {
    if (req.user?.staff_member_role === "staff")
      return res.status(403).json({ error: "需要店主权限" });
    const page = Math.max(
      1,
      Math.min(10000, Number.parseInt(req.query.page, 10) || 1),
    );
    const args = [visitorCutoff()];
    let where = " WHERE e.created_at>?";
    for (const [key, column] of [
      ["ip", "ip"],
      ["userId", "user_id"],
      ["bookingId", "booking_id"],
      ["conversationId", "conversation_id"],
    ]) {
      if (req.query[key]) {
        where += ` AND e.${column}=?`;
        args.push(String(req.query[key]).slice(0, 160));
      }
    }
    const { total } = await db
      .prepare(`SELECT COUNT(*) AS total FROM visitor_events e${where}`)
      .get(...args);
    const items = await db
      .prepare(
        `SELECT e.*,u.name AS user_name,g.country,g.region,g.city,g.geo_status,g.source
      FROM visitor_events e LEFT JOIN users u ON u.id=e.user_id LEFT JOIN visitor_ips g ON g.ip=e.ip
      ${where} ORDER BY e.created_at DESC,e.id LIMIT 25 OFFSET ?`,
      )
      .all(...args, (page - 1) * 25);
    res.json({ items, total, page, pageSize: 25, retentionDays: 180 });
  });
}
