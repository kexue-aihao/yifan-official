import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { z, ZodError } from "zod";
import { openDatabase, id, transaction, maintenance, migrateReadReceipts, migrateVisitors, migrateCommunity } from "./db.mjs";
import {configureProxy, createVisitorAudit, visitorRoutes} from './visitors.mjs';
import {browserSignalsSchema, postImagesSchema, publicationSource, postSourceRoutes} from './community.mjs';
import {imageSlots, siteImageURL, parsePostImages, MAX_POST_IMAGES} from '../shared/media.mjs';
import {apiLocale, validationError} from "./i18n.mjs";
import {themeIds} from "./appearance.mjs";
import {
  hashPassword,
  verifyPassword,
  tokenHash,
  safeEqual,
  createVault,
  signEpay,
  moneyToCents,
} from "./security.mjs";
const DAY = 86400000;
const retainAfter = () => Date.now() - 180 * DAY;
const accountSchema = z.object({
  email: z
    .email()
    .max(160)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10, "密码至少 10 位").max(128),
});
const text = (min, max) => z.string().trim().min(min).max(max);
const categories = ["婚纱灵感", "拍摄日记", "生日派对", "Cosplay", "交流问答"];
const serviceSchema = z
  .object({
    title: text(1, 60),
    english: text(1, 80),
    category: text(1, 30),
    description: text(1, 1000),
    price: z.number().int().min(1).max(100000000),
    deposit: z.number().int().min(1),
    duration: text(1, 60),
    features: z.array(text(1, 100)).min(1).max(10),
    image: z.string().trim().max(2048).refine(value => !!siteImageURL(value), '请输入有效的 HTTPS 图片链接'),
    active: z.boolean(),
    featured: z.boolean(),
    sort_order: z.number().int().min(0).max(100),
  })
  .refine((v) => v.deposit <= v.price, "订金不可大于总价");
const bookingSettingsSchema = z
  .object({
    enabled: z.boolean(),
    times: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
      .min(1)
      .max(12),
    capacity: z.number().int().min(1).max(50),
    minAdvanceDays: z.number().int().min(0).max(30),
    maxAdvanceDays: z.number().int().min(1).max(365),
    closedWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
    blockedDates: z.array(z.iso.date()).max(365),
  })
  .refine(
    (v) =>
      v.minAdvanceDays <= v.maxAdvanceDays &&
      new Set(v.times).size === v.times.length,
    "预约天数或时段设置不正确",
  );
const siteSchema = z.object({
  phone: z.string().max(40),
  address: z.string().max(200),
  hours: text(1, 100),
  wechat: z.string().max(80),
  samplePricing: z.boolean(),
  defaultTheme: z.enum(themeIds).optional(),
});
const mediaSchema = z.object({images: z.object(Object.fromEntries(
  imageSlots.map(slot => [slot, z.string().trim().max(2048).refine(value => !!siteImageURL(value), '请输入有效的 HTTPS 图片链接').optional()]),
)).strict()}).strict();
const asPost = row => ({...row, images: row.images ? JSON.parse(row.images) : []});
const epaySchema = z.object({
  enabled: z.boolean(),
  gateway: z.string().max(300),
  pid: z.string().regex(/^\d*$/).max(40),
  secret: z.string().max(200).optional(),
  methods: z
    .array(z.enum(["alipay", "wxpay", "qqpay"]))
    .min(1)
    .max(3),
});
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  throw error;
}
const publicUser = (u) =>
  u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null;
const asService = (row) => ({
  ...row,
  features: JSON.parse(row.features),
  active: !!row.active,
  featured: !!row.featured,
});
const chinaDay = (offset = 0) =>
  new Date(Date.now() + 8 * 3600000 + offset * DAY).toISOString().slice(0, 10);
const chinaNow = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(11, 16);
export async function createApp(options = {}) {
  const db = options.db || (await openDatabase());
  await migrateReadReceipts(db);
  await migrateVisitors(db);
  await migrateCommunity(db);
  const recordVisit = createVisitorAudit(db);
  const vault = options.vault || createVault();
  const origin =
    options.origin || process.env.APP_ORIGIN || "http://localhost:5173";
  if (
    !options.testing &&
    process.env.NODE_ENV === "production" &&
    !origin.startsWith("https://")
  )
    throw new Error("Production APP_ORIGIN must use HTTPS");
  const app = express();
  app.use(apiLocale);
  const streams = new Map();
  const setting = async (key) =>
    JSON.parse(
      (
        await db
          .prepare("SELECT value FROM settings WHERE setting_key=?")
          .get(key)
      ).value,
    );
  const saveSetting = async (key, value) =>
    await db
      .prepare("UPDATE settings SET value=? WHERE setting_key=?")
      .run(JSON.stringify(value), key);
  const audit = async (actor, action, target) =>
    await db
      .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
      .run(id(), actor, action, target, Date.now());
  const emit = (userIds, event) => {
    for (const userId of new Set(userIds))
      for (const res of streams.get(userId) || [])
        res.write(`event: update\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const admins = async () =>
    (await db.prepare("SELECT id FROM users WHERE role='admin'").all()).map(
      (u) => u.id,
    );
  const threadOwner = async (req, threadId) => {
    const thread = await db
      .prepare("SELECT * FROM conversations WHERE id=?")
      .get(threadId);
    if (
      !thread ||
      (req.user.role !== "admin" && thread.user_id !== req.user.id)
    )
      fail(404, "会话不存在");
    return thread;
  };
  const auth = (req, _res, next) => {
    if (!req.user)
      return next(Object.assign(new Error("请先登录"), { status: 401 }));
    next();
  };
  const admin = (req, _res, next) => {
    if (!req.user)
      return next(Object.assign(new Error("请先登录"), { status: 401 }));
    if (req.user.role !== "admin")
      return next(Object.assign(new Error("需要管理员权限"), { status: 403 }));
    next();
  };
  const loginSession = async (user, res) => {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    await db
      .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
      .run(tokenHash(token), user.id, csrf, Date.now() + 7 * DAY);
    res.cookie("yf_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      maxAge: 7 * DAY,
      path: "/",
    });
    return csrf;
  };
  app.disable("x-powered-by");
  configureProxy(app);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
      strictTransportSecurity:
        process.env.NODE_ENV === "production" ? undefined : false,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.use(cookieParser());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: options.testing ? 10000 : 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "请求过于频繁，请稍后再试" },
    }),
  );
  app.use("/api", async (req, _res, next) => {
    if (typeof req.cookies.yf_session === "string") {
      const session = await db
        .prepare(
          "SELECT users.*, sessions.csrf, sessions.token_hash FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
        )
        .get(tokenHash(req.cookies.yf_session), Date.now());
      if (session) req.user = session;
    }
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      req.path !== "/payments/epay/notify"
    ) {
      if (req.get("origin") !== origin)
        return next(
          Object.assign(new Error("请求来源不正确，请刷新页面后重试"), {
            status: 403,
          }),
        );
      if (req.user && !safeEqual(req.get("x-csrf-token"), req.user.csrf))
        return next(
          Object.assign(new Error("会话校验失败，请刷新页面"), { status: 403 }),
        );
    }
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: options.testing ? 200 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "尝试次数过多，请 15 分钟后重试" },
  });
  const writeLimit = rateLimit({
    windowMs: 60000,
    limit: options.testing ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "操作频繁，请稍等片刻" },
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.post('/api/visits', writeLimit, async (req,res) => {
    const input = z.object({eventId:z.uuid(),path:z.string().max(256).regex(/^\/(?!\/)[^?#\s]*$/)}).parse(req.body);
    try { await recordVisit(req,'page',input); }
    catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; }
    res.status(202).json({ok:true});
  });
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user), csrf: req.user?.csrf || null }),
  );
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const input = accountSchema
      .extend({ name: text(1, 30), consent: z.literal(true) })
      .parse(req.body);
    if (await db.prepare("SELECT id FROM users WHERE email=?").get(input.email))
      fail(409, "该邮箱已注册，请登录");
    const user = {
      id: id(),
      name: input.name,
      email: input.email,
      role: "customer",
    };
    const password = await hashPassword(input.password);
    try {
      await db
        .prepare("INSERT INTO users VALUES (?,?,?,?,?,?)")
        .run(user.id, user.email, user.name, password, "customer", Date.now());
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") fail(409, "该邮箱已注册，请登录");
      throw error;
    }
    req.user=user;
    await recordVisit(req,'register');
    res.status(201).json({ user, csrf: await loginSession(user, res) });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const input = accountSchema.parse(req.body);
    const user = await db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(input.email);
    // Run scrypt even for an unknown email to reduce account timing differences.
    const correct = user
      ? await verifyPassword(input.password, user.password)
      : (await hashPassword(input.password), false);
    if (!correct) fail(401, "邮箱或密码不正确");
    if (req.user)
      await db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(req.user.token_hash);
    req.user=user;
    await recordVisit(req,'login');
    res.json({ user: publicUser(user), csrf: await loginSession(user, res) });
  });
  app.post("/api/auth/logout", auth, async (req, res) => {
    await db
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(req.user.token_hash);
    for (const response of streams.get(req.user.id) || []) {
      response.write("event: logout\ndata: {}\n\n");
      response.end();
    }
    res.clearCookie("yf_session", { path: "/" }).json({ ok: true });
  });
  app.get("/api/settings", async (_req, res) => {
    const epay = await setting("epay");
    res.json({
      site: await setting("site"),
      media: await setting("media"),
      booking: await setting("booking"),
      payment: {
        available: !!(epay.enabled && epay.gateway && epay.pid && epay.secret),
        methods: epay.methods,
      },
      retentionDays: 180,
    });
  });
  app.get("/api/services", async (_req, res) =>
    res.json(
      (
        await db
          .prepare("SELECT * FROM services WHERE active=1 ORDER BY sort_order")
          .all()
      ).map(asService),
    ),
  );
  async function available(day) {
    z.iso.date().parse(day);
    await maintenance(db);
    const config = await setting("booking");
    const weekday = new Date(`${day}T12:00:00+08:00`).getUTCDay();
    const valid =
      config.enabled &&
      day >= chinaDay(config.minAdvanceDays) &&
      day <= chinaDay(config.maxAdvanceDays) &&
      !config.closedWeekdays.includes(weekday) &&
      !config.blockedDates.includes(day);
    return await Promise.all(
      config.times.map(async (time) => {
        const count = (
          await db
            .prepare(
              "SELECT COUNT(*) AS n FROM bookings WHERE day=? AND time=? AND status IN ('pending','paid','confirmed','completed')",
            )
            .get(day, time)
        ).n;
        return {
          time,
          remaining:
            valid && (day !== chinaDay() || time > chinaNow())
              ? Math.max(0, config.capacity - Number(count))
              : 0,
        };
      }),
    );
  }
  app.get("/api/availability", async (req, res) =>
    res.json(await available(req.query.date)),
  );
  app.post("/api/bookings", auth, writeLimit, async (req, res) => {
    const input = z
      .object({
        serviceId: text(1, 80),
        day: z.iso.date(),
        time: z.string(),
        contactName: text(1, 30),
        phone: z.string().regex(/^\+?[\d\s-]{7,20}$/, "请输入有效联系电话"),
        note: z.string().trim().max(1000).default(""),
        requestKey: z.uuid(),
      })
      .parse(req.body);
    const previous = await db
      .prepare("SELECT * FROM bookings WHERE user_id=? AND request_key=?")
      .get(req.user.id, input.requestKey);
    if (previous) return res.json(previous);
    const result = await transaction(db, async () => {
      const retry = await db
        .prepare("SELECT * FROM bookings WHERE user_id=? AND request_key=?")
        .get(req.user.id, input.requestKey);
      if (retry) return { booking: retry, created: false };
      const currentSlots = await available(input.day);
      if (!currentSlots.some((s) => s.time === input.time && s.remaining > 0))
        fail(409, "该时段暂不可预约，请重新选择");
      const service = await db
        .prepare("SELECT * FROM services WHERE id=? AND active=1")
        .get(input.serviceId);
      if (!service) fail(404, "服务已下架，请选择其他服务");
      const config = await setting("booking");
      const count = (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM bookings WHERE day=? AND time=? AND status IN ('pending','paid','confirmed','completed')",
          )
          .get(input.day, input.time)
      ).n;
      if (Number(count) >= config.capacity)
        fail(409, "该时段刚刚约满，请选择其他时间");
      const duplicate = await db
        .prepare(
          "SELECT id FROM bookings WHERE user_id=? AND day=? AND time=? AND status IN ('pending','paid','confirmed')",
        )
        .get(req.user.id, input.day, input.time);
      if (duplicate) fail(409, "你已经预约了该时段，请在我的预约中查看");
      const bookingId = id(),
        now = Date.now();
      await db
        .prepare(
          "INSERT INTO bookings(id,user_id,service_id,service_title,price,deposit,day,time,contact_name,phone,note,created_at,expires_at,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          bookingId,
          req.user.id,
          service.id,
          service.title,
          service.price,
          service.deposit,
          input.day,
          input.time,
          input.contactName,
          input.phone,
          input.note,
          now,
          now + 30 * 60000,
          input.requestKey,
        );
      await db
        .prepare(
          "INSERT INTO conversations(id,user_id,booking_id,created_at) VALUES (?,?,?,?)",
        )
        .run(id(), req.user.id, bookingId, now);
      const conversation = await db.prepare('SELECT id FROM conversations WHERE booking_id=?').get(bookingId);
      await recordVisit(req,'booking',{bookingId,conversationId:conversation.id});
      return {
        booking: await db
          .prepare("SELECT * FROM bookings WHERE id=?")
          .get(bookingId),
        created: true,
      };
    });
    if (result.created) emit(await admins(), { type: "booking" });
    res.status(result.created ? 201 : 200).json(result.booking);
  });
  app.get("/api/bookings", auth, async (req, res) => {
    await maintenance(db);
    res.json(
      await db
        .prepare(
          "SELECT b.*, c.id AS conversation_id, p.id AS payment_id, v.viewed_at AS staff_viewed_at FROM bookings b LEFT JOIN conversations c ON c.booking_id=b.id LEFT JOIN payments p ON p.booking_id=b.id LEFT JOIN booking_staff_views v ON v.booking_id=b.id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 200",
        )
        .all(req.user.id),
    );
  });
  app.post("/api/bookings/:id/cancel", auth, async (req, res) => {
    await maintenance(db);
    await transaction(db, async () => {
      const booking = await db
        .prepare("SELECT * FROM bookings WHERE id=? AND user_id=?")
        .get(req.params.id, req.user.id);
      if (!booking) fail(404, "预约不存在");
      if (booking.status !== "pending")
        fail(409, "当前预约无法直接取消，请联系工作人员");
      if (
        await db
          .prepare("SELECT id FROM payments WHERE booking_id=?")
          .get(booking.id)
      )
        fail(409, "该订单已进入支付流程，请联系客服处理，或等待 30 分钟到期");
      await db
        .prepare("UPDATE bookings SET status='cancelled' WHERE id=?")
        .run(booking.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/payments/epay/create", auth, writeLimit, async (req, res) => {
    const input = z
      .object({
        bookingId: z.uuid(),
        method: z.enum(["alipay", "wxpay", "qqpay"]),
      })
      .parse(req.body);
    await maintenance(db);
    const { booking, payment } = await transaction(db, async () => {
      const booking = await db
        .prepare("SELECT * FROM bookings WHERE id=? AND user_id=?")
        .get(input.bookingId, req.user.id);
      if (!booking) fail(404, "预约不存在");
      if (booking.status !== "pending")
        fail(409, "当前订单不可支付，请查看最新状态");
      const config = await setting("epay");
      if (!config.enabled || !config.gateway || !config.pid || !config.secret)
        fail(503, "在线支付尚未开通，请联系客服确认预约");
      if (!config.methods.includes(input.method))
        fail(400, "此支付方式暂未启用");
      let payment = await db
        .prepare("SELECT * FROM payments WHERE booking_id=?")
        .get(booking.id);
      if (!payment) {
        const paymentId = `YF${Date.now()}${randomBytes(6).toString("hex")}`;
        await db
          .prepare(
            "INSERT INTO payments(id,booking_id,amount,method,pid,secret,gateway,created_at) VALUES (?,?,?,?,?,?,?,?)",
          )
          .run(
            paymentId,
            booking.id,
            booking.deposit,
            input.method,
            config.pid,
            config.secret,
            config.gateway,
            Date.now(),
          );
        payment = await db
          .prepare("SELECT * FROM payments WHERE id=?")
          .get(paymentId);
      }
      return { booking, payment };
    });
    const params = {
      pid: payment.pid,
      type: payment.method,
      out_trade_no: payment.id,
      notify_url: `${origin}/api/payments/epay/notify`,
      return_url: `${origin}/account?payment=returned`,
      name: `壹梵定制-${booking.service_title}订金`,
      money: (payment.amount / 100).toFixed(2),
    };
    params.sign = signEpay(params, vault.decrypt(payment.secret));
    params.sign_type = "MD5";
    const gateway = new URL(
      "submit.php",
      payment.gateway.endsWith("/") ? payment.gateway : `${payment.gateway}/`,
    );
    gateway.search = new URLSearchParams(params).toString();
    res.json({ paymentId: payment.id, url: gateway.toString() });
  });
  app.all("/api/payments/epay/notify", async (req, res) => {
    if (!["GET", "POST"].includes(req.method))
      return res.status(405).type("text").send("fail");
    try {
      const params = req.method === "GET" ? req.query : req.body;
      if (!params || Object.values(params).some((v) => typeof v !== "string"))
        return res.status(400).type("text").send("fail");
      const payment = await db
        .prepare("SELECT * FROM payments WHERE id=?")
        .get(params.out_trade_no || "");
      if (
        !payment ||
        params.sign_type !== "MD5" ||
        !safeEqual(
          signEpay(params, vault.decrypt(payment.secret)),
          params.sign,
        ) ||
        params.pid !== payment.pid ||
        moneyToCents(params.money) !== payment.amount ||
        params.trade_status !== "TRADE_SUCCESS" ||
        !/^[\w-]{1,100}$/.test(params.trade_no || "")
      )
        return res.status(400).type("text").send("fail");
      const ownerId = await transaction(db, async () => {
        const current = await db
          .prepare("SELECT * FROM payments WHERE id=?")
          .get(payment.id);
        const booking = await db
          .prepare("SELECT * FROM bookings WHERE id=?")
          .get(payment.booking_id);
        if (current.status === "paid") {
          if (current.trade_no !== params.trade_no) fail(400, "交易号不匹配");
          return booking.user_id;
        }
        const timely =
          booking.status === "pending" && booking.expires_at > Date.now();
        await db
          .prepare(
            "UPDATE payments SET status='paid',trade_no=?,paid_at=? WHERE id=?",
          )
          .run(params.trade_no, Date.now(), payment.id);
        await db
          .prepare("UPDATE bookings SET status=?, paid_at=? WHERE id=?")
          .run(timely ? "paid" : "refund_review", Date.now(), booking.id);
        await audit(
          "epay",
          timely ? "payment.received" : "payment.late_review",
          booking.id,
        );
        return booking.user_id;
      });
      emit([ownerId, ...(await admins())], { type: "booking" });
      res.type("text").send("success");
    } catch {
      res.status(400).type("text").send("fail");
    }
  });
  app.get("/api/events", auth, (req, res) => {
    const existing = streams.get(req.user.id) || new Set();
    if (existing.size >= 5) fail(429, "实时连接过多，请关闭多余页面");
    res.set({
      "Content-Type": "text/event-stream",
      // Proxies (including Next.js dev rewrites) must not gzip/buffer events.
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write("retry: 3000\nevent: connected\ndata: {}\n\n");
    existing.add(res);
    streams.set(req.user.id, existing);
    const heartbeat = setInterval(async () => {
      try {
        const valid = await db
          .prepare(
            "SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?",
          )
          .get(req.user.token_hash, Date.now());
        if (!valid) {
          res.write("event: logout\ndata: {}\n\n");
          res.end();
          return;
        }
        res.write(": heartbeat\n\n");
      } catch {
        res.end();
      }
    }, 20000);
    res.on("close", () => {
      clearInterval(heartbeat);
      existing.delete(res);
      if (!existing.size) streams.delete(req.user.id);
    });
  });
  app.get("/api/conversations", auth, async (req, res) => {
    const condition = req.user.role === "admin" ? "" : "WHERE c.user_id=?";
    const params =
      req.user.role === "admin"
        ? [retainAfter()]
        : [retainAfter(), req.user.id];
    res.json(
      await db
        .prepare(
          `SELECT c.*,u.name AS customer_name,b.service_title,b.service_id,b.day,
      (SELECT body FROM messages WHERE conversation_id=c.id AND created_at>? ORDER BY created_at DESC LIMIT 1) AS last_message
      FROM conversations c JOIN users u ON u.id=c.user_id LEFT JOIN bookings b ON b.id=c.booking_id ${condition}
      ORDER BY COALESCE((SELECT MAX(created_at) FROM messages WHERE conversation_id=c.id), c.created_at) DESC LIMIT 200`,
        )
        .all(...params),
    );
  });
  app.post("/api/conversations", auth, async (req, res) => {
    const input = z.object({ bookingId: z.uuid().optional() }).parse(req.body);
    if (input.bookingId) {
      const booking = await db
        .prepare("SELECT id FROM bookings WHERE id=? AND user_id=?")
        .get(input.bookingId, req.user.id);
      if (!booking) fail(404, "预约不存在");
    }
    let thread = input.bookingId
      ? await db
          .prepare("SELECT * FROM conversations WHERE booking_id=?")
          .get(input.bookingId)
      : await db
          .prepare(
            "SELECT * FROM conversations WHERE user_id=? AND booking_id IS NULL",
          )
          .get(req.user.id);
    if (!thread) {
      const threadId = id();
      await db
        .prepare(
          "INSERT IGNORE INTO conversations(id,user_id,booking_id,created_at) VALUES (?,?,?,?)",
        )
        .run(threadId, req.user.id, input.bookingId || null, Date.now());
      thread = await db
        .prepare(
          "SELECT * FROM conversations WHERE user_id=? AND booking_id <=> ?",
        )
        .get(req.user.id, input.bookingId || null);
    }
    await recordVisit(req,'conversation',{bookingId:thread.booking_id,conversationId:thread.id});
    res.json(thread);
  });
  app.get("/api/conversations/:id/messages", auth, async (req, res) => {
    await threadOwner(req, req.params.id);
    let anchor = { created_at: Date.now() + 1, seq: Number.MAX_SAFE_INTEGER };
    if (req.query.before !== undefined) {
      const before = z.uuid().parse(req.query.before);
      anchor = await db
        .prepare(
          "SELECT created_at,seq FROM messages WHERE id=? AND conversation_id=? AND created_at>?",
        )
        .get(before, req.params.id, retainAfter());
      if (!anchor) fail(404, "该历史消息已过期或不存在");
    }
    const rows = await db
      .prepare(
        "SELECT m.*,u.name AS sender_name,u.role AS sender_role,r.read_at AS staff_read_at FROM messages m JOIN users u ON u.id=m.sender_id LEFT JOIN message_staff_reads r ON r.message_id=m.id WHERE conversation_id=? AND m.created_at>? AND (m.created_at<? OR (m.created_at=? AND m.seq<?)) ORDER BY m.created_at DESC, m.seq DESC LIMIT 100",
      )
      .all(
        req.params.id,
        retainAfter(),
        anchor.created_at,
        anchor.created_at,
        anchor.seq,
      );
    res.json(rows.reverse());
  });
  app.post("/api/conversations/:id/read", admin, writeLimit, async (req, res) => {
    const thread = await threadOwner(req, req.params.id);
    const { messageIds } = z.object({messageIds: z.array(z.uuid()).min(1).max(100)}).parse(req.body);
    const ids = [...new Set(messageIds)];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.prepare(
      "SELECT id FROM messages WHERE conversation_id=? AND sender_id=? AND created_at>? AND id IN (" + placeholders + ")",
    ).all(thread.id, thread.user_id, retainAfter(), ...ids);
    if (rows.length !== ids.length) fail(404, "该历史消息已过期或不存在");
    const readAt = Date.now();
    const result = await db.prepare(
      "INSERT IGNORE INTO message_staff_reads(message_id,staff_id,read_at) SELECT id,?,? FROM messages WHERE conversation_id=? AND sender_id=? AND created_at>? AND id IN (" + placeholders + ")",
    ).run(req.user.id, readAt, thread.id, thread.user_id, retainAfter(), ...ids);
    const receipts = await db.prepare(
      "SELECT message_id AS id,read_at AS staff_read_at FROM message_staff_reads WHERE message_id IN (" + placeholders + ")",
    ).all(...ids);
    if (result.changes) emit([thread.user_id, ...(await admins())], {
      type: "messages-read", conversationId: thread.id, receipts,
    });
    res.json({receipts});
  });
  app.post(
    "/api/conversations/:id/messages",
    auth,
    writeLimit,
    async (req, res) => {
      const thread = await threadOwner(req, req.params.id);
      const { body } = z.object({ body: text(1, 2000) }).parse(req.body);
      const messageId = id();
      await transaction(db, async () => {
      await db
        .prepare(
          "INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)",
        )
        .run(messageId, thread.id, req.user.id, body, Date.now());
      await recordVisit(req,'message',{bookingId:thread.booking_id,conversationId:thread.id,messageId});
      });
      emit([thread.user_id, ...(await admins())], {
        type: "message",
        conversationId: thread.id,
      });
      res.status(201).json({ id: messageId });
    },
  );
  const postSelect = `SELECT p.*,u.name AS author,m.images,(SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comment_count,(SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS like_count FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN post_media m ON m.post_id=p.id`;
  app.get("/api/posts", async (req, res) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(1)
      .parse(req.query.page);
    const category = z.enum(categories).optional().parse(req.query.category);
    const where = category
      ? "WHERE p.hidden=0 AND p.category=?"
      : "WHERE p.hidden=0";
    const args = category ? [category] : [];
    const posts = await db
      .prepare(
        `${postSelect} ${where} ORDER BY p.created_at DESC LIMIT 12 OFFSET ?`,
      )
      .all(...args, (page - 1) * 12);
    const total = (
      await db
        .prepare(`SELECT COUNT(*) AS n FROM posts p ${where}`)
        .get(...args)
    ).n;
    res.json({ posts: posts.map(asPost), total: Number(total), page, pageSize: 12 });
  });
  app.post("/api/posts", auth, writeLimit, async (req, res) => {
    const input = z
      .object({
        title: text(2, 100),
        body: text(5, 10000),
        category: z.enum(categories),
        images: postImagesSchema,
        browserSignals: browserSignalsSchema.optional(),
      })
      .parse(req.body);
    const postId = id();
    const inlineImages = parsePostImages(input.body).filter(part => part.type === 'image');
    if (inlineImages.length + input.images.length > MAX_POST_IMAGES) fail(400, '每篇帖子最多 9 张图片');
    const source = publicationSource(req,input,vault);
    const createdAt = Date.now();
    await transaction(db, async () => {
    await db
      .prepare(
        "INSERT INTO posts(id,user_id,title,body,category,created_at) VALUES (?,?,?,?,?,?)",
      )
      .run(
        postId,
        req.user.id,
        input.title,
        input.body,
        input.category,
        createdAt,
      );
    await db.prepare('INSERT INTO post_media(post_id,images) VALUES (?,?)').run(postId,JSON.stringify(input.images));
    await db.prepare(`INSERT INTO post_sources(post_id,user_id,ip,fingerprint,fingerprint_version,fingerprint_quality,browser_signals,user_agent,accept_language,client_hints,location,content_hash,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(postId,req.user.id,source.ip,source.fingerprint,source.fingerprint_version,source.fingerprint_quality,source.browser_signals,source.user_agent,source.accept_language,source.client_hints,source.location,source.content_hash,createdAt);
    });
    res.status(201).json({ id: postId });
  });
  app.get("/api/posts/:id", async (req, res) => {
    const post = await db
      .prepare(`${postSelect} WHERE p.id=? AND p.hidden=0`)
      .get(req.params.id);
    if (!post) fail(404, "帖子不存在或已被隐藏");
    const liked = !!(
      req.user &&
      (await db
        .prepare("SELECT 1 FROM likes WHERE post_id=? AND user_id=?")
        .get(post.id, req.user.id))
    );
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(1)
      .parse(req.query.page);
    const comments = await db
      .prepare(
        "SELECT c.*,u.name AS author FROM comments c JOIN users u ON u.id=c.user_id WHERE post_id=? ORDER BY c.created_at LIMIT 50 OFFSET ?",
      )
      .all(post.id, (page - 1) * 50);
    res.json({
      ...asPost(post),
      liked,
      comments,
      commentPage: page,
      commentPageSize: 50,
    });
  });
  app.delete("/api/posts/:id", auth, async (req, res) => {
    const post = await db
      .prepare("SELECT * FROM posts WHERE id=?")
      .get(req.params.id);
    if (!post || (post.user_id !== req.user.id && req.user.role !== "admin"))
      fail(404, "帖子不存在");
    await db.prepare("DELETE FROM posts WHERE id=?").run(post.id);
    res.json({ ok: true });
  });
  app.post("/api/posts/:id/comments", auth, writeLimit, async (req, res) => {
    if (
      !(await db
        .prepare("SELECT id FROM posts WHERE id=? AND hidden=0")
        .get(req.params.id))
    )
      fail(404, "帖子不存在");
    const { body } = z.object({ body: text(1, 2000) }).parse(req.body);
    const commentId = id();
    await db
      .prepare("INSERT INTO comments VALUES (?,?,?,?,?)")
      .run(commentId, req.params.id, req.user.id, body, Date.now());
    res.status(201).json({ id: commentId });
  });
  app.post("/api/posts/:id/like", auth, writeLimit, async (req, res) => {
    if (
      !(await db
        .prepare("SELECT id FROM posts WHERE id=? AND hidden=0")
        .get(req.params.id))
    )
      fail(404, "帖子不存在");
    const existing = await db
      .prepare("SELECT 1 FROM likes WHERE post_id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (existing)
      await db
        .prepare("DELETE FROM likes WHERE post_id=? AND user_id=?")
        .run(req.params.id, req.user.id);
    else
      await db
        .prepare("INSERT INTO likes VALUES (?,?)")
        .run(req.params.id, req.user.id);
    res.json({ liked: !existing });
  });
  app.use("/api/admin", admin);
  visitorRoutes(app,db);
  postSourceRoutes(app,db);
  app.get("/api/admin/overview", async (_req, res) => {
    await maintenance(db);
    res.json({
      customers: Number(
        (
          await db
            .prepare("SELECT COUNT(*) AS n FROM users WHERE role='customer'")
            .get()
        ).n,
      ),
      bookings: Number(
        (await db.prepare("SELECT COUNT(*) AS n FROM bookings").get()).n,
      ),
      awaiting: Number(
        (
          await db
            .prepare("SELECT COUNT(*) AS n FROM bookings WHERE status='paid'")
            .get()
        ).n,
      ),
      revenue: Number(
        (
          await db
            .prepare(
              "SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE status='paid'",
            )
            .get()
        ).n,
      ),
    });
  });
  app.get("/api/admin/bookings", async (_req, res) => {
    await maintenance(db);
    res.json(
      await db
        .prepare(
          "SELECT b.*,u.name AS customer_name,c.id AS conversation_id,v.viewed_at AS staff_viewed_at FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN conversations c ON c.booking_id=b.id LEFT JOIN booking_staff_views v ON v.booking_id=b.id ORDER BY b.created_at DESC LIMIT 500",
        )
        .all(),
    );
  });
  app.post("/api/admin/bookings/:id/view", writeLimit, async (req, res) => {
    const booking = await db.prepare("SELECT id,user_id FROM bookings WHERE id=?").get(req.params.id);
    if (!booking) fail(404, "预约不存在");
    const result = await db.prepare(
      "INSERT IGNORE INTO booking_staff_views(booking_id,staff_id,viewed_at) VALUES (?,?,?)",
    ).run(booking.id, req.user.id, Date.now());
    const receipt = await db.prepare(
      "SELECT viewed_at AS staff_viewed_at FROM booking_staff_views WHERE booking_id=?",
    ).get(booking.id);
    if (result.changes) emit([booking.user_id, ...(await admins())], {type:"booking-viewed",bookingId:booking.id});
    res.json(receipt);
  });
  app.patch("/api/admin/bookings/:id", async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["confirmed", "completed"]) })
      .parse(req.body);
    const booking = await transaction(db, async () => {
      const current = await db
        .prepare("SELECT * FROM bookings WHERE id=?")
        .get(req.params.id);
      if (!current) fail(404, "预约不存在");
      if (!(
        (current.status === "paid" && status === "confirmed") ||
        (current.status === "confirmed" && status === "completed")
      ))
        fail(409, "请按照已支付 → 已确认 → 已完成处理订单");
      await db
        .prepare("UPDATE bookings SET status=? WHERE id=?")
        .run(status, current.id);
      await audit(req.user.id, `booking.${status}`, current.id);
      return current;
    });
    emit([booking.user_id, ...(await admins())], { type: "booking" });
    res.json({ ok: true });
  });
  app.get("/api/admin/services", async (_req, res) =>
    res.json(
      (
        await db.prepare("SELECT * FROM services ORDER BY sort_order").all()
      ).map(asService),
    ),
  );
  app.post("/api/admin/services", async (req, res) => {
    const input = serviceSchema.parse(req.body),
      serviceId = id();
    const values = [
      input.title,
      input.english,
      input.category,
      input.description,
      input.price,
      input.deposit,
      input.duration,
      JSON.stringify(input.features),
      input.image,
      Number(input.active),
      Number(input.featured),
      input.sort_order,
    ];
    await transaction(db, async () => {
      await db
        .prepare(
          "INSERT INTO services(title,english,category,description,price,deposit,duration,features,image,active,featured,sort_order,id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(...values, serviceId);
      await audit(req.user.id, "service.create", serviceId);
    });
    res.status(201).json({ id: serviceId });
  });
  app.put("/api/admin/services/:id", async (req, res) => {
    const v = serviceSchema.parse(req.body);
    if (
      !(await db
        .prepare("SELECT id FROM services WHERE id=?")
        .get(req.params.id))
    )
      fail(404, "服务不存在");
    await transaction(db, async () => {
      await db
        .prepare(
          "UPDATE services SET title=?,english=?,category=?,description=?,price=?,deposit=?,duration=?,features=?,image=?,active=?,featured=?,sort_order=? WHERE id=?",
        )
        .run(
          v.title,
          v.english,
          v.category,
          v.description,
          v.price,
          v.deposit,
          v.duration,
          JSON.stringify(v.features),
          v.image,
          Number(v.active),
          Number(v.featured),
          v.sort_order,
          req.params.id,
        );
      await audit(req.user.id, "service.update", req.params.id);
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/settings", async (_req, res) => {
    const epay = await setting("epay");
    res.json({
      site: await setting("site"),
      media: await setting("media"),
      booking: await setting("booking"),
      epay: { ...epay, secret: "", hasSecret: !!epay.secret },
    });
  });
  app.put("/api/admin/settings/:key", async (req, res) => {
    const key = req.params.key;
    let input;
    if (key === "site") {
      input = siteSchema.parse(req.body);
      // Older clients saving contact details must preserve the chosen appearance.
      input.defaultTheme ??= (await setting("site")).defaultTheme || "ivory";
    }
    else if (key === "media") input = mediaSchema.parse(req.body);
    else if (key === "booking") input = bookingSettingsSchema.parse(req.body);
    else if (key === "epay") {
      input = epaySchema.parse(req.body);
      if (input.gateway) {
        let url;
        try {
          url = new URL(input.gateway);
        } catch {
          fail(400, "请输入有效网关地址");
        }
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          fail(400, "网关须为无账号和查询参数的 HTTPS 根目录地址");
        input.gateway = url.toString();
      }
      input.secret = input.secret
        ? vault.encrypt(input.secret)
        : (await setting("epay")).secret;
      if (input.enabled && (!input.gateway || !input.pid || !input.secret))
        fail(400, "启用支付前请填写网关、商户号和密钥");
    } else fail(404, "设置项不存在");
    await transaction(db, async () => {
      await saveSetting(key, input);
      await audit(req.user.id, "settings.update", key);
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/posts", async (_req, res) =>
    res.json(
      (await db
        .prepare(`${postSelect} ORDER BY p.created_at DESC LIMIT 300`)
        .all()).map(asPost),
    ),
  );
  app.patch("/api/admin/posts/:id", async (req, res) => {
    const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body);
    const result = await db
      .prepare("UPDATE posts SET hidden=? WHERE id=?")
      .run(Number(hidden), req.params.id);
    if (!result.changes) fail(404, "帖子不存在");
    await audit(
      req.user.id,
      hidden ? "post.hide" : "post.restore",
      req.params.id,
    );
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
  app.use((error, req, res, _next) => {
    if (res.headersSent) return res.end();
    if (error instanceof ZodError)
      return res.status(400).json(validationError(error, req.yifanLocale));
    const status =
      error.status || (error.type === "entity.too.large" ? 413 : 500);
    if (status >= 500 && !error.expose)
      console.error("Request failed:", error.message);
    res.status(status).json({
      error:
        status >= 500 && !error.expose
          ? "服务暂时不可用，请稍后再试"
          : error.message,
    });
  });
  await maintenance(db);
  const cleanup = setInterval(
    () =>
      maintenance(db).catch((error) =>
        console.error("Maintenance failed:", error.code || error.message),
      ),
    3600000,
  );
  cleanup.unref();
  return {
    app,
    db,
    close: async () => {
      clearInterval(cleanup);
      for (const set of streams.values())
        for (const response of set) response.end();
      await db.close();
    },
  };
}
