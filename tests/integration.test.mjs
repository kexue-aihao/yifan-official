import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { maintenance } from "../server/db.mjs";
import { createTestDatabase } from "./mysql-fixture.mjs";
import {
  hashPassword,
  createVault,
  signEpay,
  moneyToCents,
} from "../server/security.mjs";
test("壹梵 API：完整业务及权限回归", async (t) => {
  process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const fixture = await createTestDatabase();
  const db = fixture.db;
  const vault = createVault();
  const origin = "http://yifan.test";
  const instance = await createApp({ db, vault, origin, testing: true });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await instance.close();
    await fixture.cleanup();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const tomorrow = new Date(Date.now() + 8 * 3600000 + 86400000)
    .toISOString()
    .slice(0, 10);
  class Client {
    cookie = "";
    csrf = "";
    user;
    async req(path, method = "GET", body, extra = {}) {
      const headers = {
        origin,
        "content-type": "application/json",
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(this.csrf ? { "x-csrf-token": this.csrf } : {}),
        ...extra,
      };
      const response = await fetch(`${base}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const cookie = response.headers.getSetCookie()[0];
      if (cookie) this.cookie = cookie.split(";")[0];
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      if (data.csrf) this.csrf = data.csrf;
      if (data.user) this.user = data.user;
      return { status: response.status, data, headers: response.headers };
    }
  }
  const anon = new Client(),
    alice = new Client(),
    bob = new Client(),
    admin = new Client(),
    staff = new Client();
  let booking, threadId, payment, service, staffId;
  const bookingBody = (time = "10:00") => ({
    serviceId: "bridal",
    day: tomorrow,
    time,
    contactName: "测试顾客",
    phone: "13800000000",
    note: "自然纪实风",
    requestKey: randomUUID(),
  });
  await t.test("匿名权限、输入校验、Cookie 会话与密码保护", async () => {
    assert.equal((await anon.req("/bookings")).status, 401);
    assert.equal((await anon.req("/admin/settings")).status, 401);
    assert.equal(
      (await anon.req("/bookings", "POST", bookingBody())).status,
      401,
    );
    assert.equal((await anon.req("/availability?date=not-a-date")).status, 400);
    assert.equal(
      (
        await anon.req("/auth/register", "POST", {
          name: "A",
          email: "bad",
          password: "1",
          consent: true,
        })
      ).status,
      400,
    );
    const a = await alice.req("/auth/register", "POST", {
      name: "Alice",
      email: "ALICE@example.com",
      password: "TestPassword123!",
      consent: true,
      role: "admin",
    });
    assert.equal(a.status, 201);
    assert.equal(a.data.user.role, "customer");
    assert.equal(a.data.user.email, "alice@example.com");
    assert.ok(a.headers.get("set-cookie").includes("HttpOnly"));
    assert.ok(a.headers.get("set-cookie").includes("SameSite=Lax"));
    await bob.req("/auth/register", "POST", {
      name: "Bob",
      email: "bob@example.com",
      password: "TestPassword123!",
      consent: true,
    });
    assert.equal(
      (
        await anon.req("/auth/login", "POST", {
          email: "alice@example.com",
          password: "WrongPassword!",
        })
      ).status,
      401,
    );
    assert.equal((await alice.req("/admin/settings")).status, 403);
    assert.equal(
      (await alice.req("/conversations", "POST", {}, { "x-csrf-token": "" }))
        .status,
      403,
    );
    assert.equal(
      (
        await alice.req(
          "/conversations",
          "POST",
          {},
          { origin: "https://untrusted.invalid" },
        )
      ).status,
      403,
    );
    const row = await db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(alice.user.id);
    assert.notEqual(row.password, "TestPassword123!");
    assert.match(row.password, /^[a-f0-9]+:[a-f0-9]+$/);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS n FROM sessions WHERE token_hash=?")
          .get(alice.cookie.split("=")[1])
      ).n,
      0,
    );
    const adminId = randomUUID();
    await db
      .prepare("INSERT INTO users VALUES (?,?,?,?,?,?)")
      .run(
        adminId,
        "admin@example.com",
        "测试管理员",
        await hashPassword("AdminPassword123!"),
        "admin",
        Date.now(),
      );
    assert.equal(
      (
        await admin.req("/auth/login", "POST", {
          email: "admin@example.com",
          password: "AdminPassword123!",
        })
      ).status,
      200,
    );
    assert.equal(admin.user.staffRole, "owner");
    const createdStaff = await admin.req("/admin/staff", "POST", {
      name: "林老师",
      email: "photographer@example.com",
      password: "Photographer123!",
      title: "摄影师",
      sortOrder: 1,
    });
    assert.equal(createdStaff.status, 201);
    staffId = createdStaff.data.id;
    const staffLogin = await staff.req("/auth/login", "POST", {
      email: "photographer@example.com",
      password: "Photographer123!",
    });
    assert.equal(staffLogin.status, 200);
    assert.equal(staff.user.name, "林老师");
    assert.equal(staff.user.staffTitle, "摄影师");
    assert.equal(staff.user.staffRole, "staff");
    assert.equal((await staff.req("/admin/settings/site", "PUT", {})).status, 403);
  });
  await t.test("预约容量、价格服务端计算、重复提交与对象隔离", async () => {
    const config = (await admin.req("/admin/settings")).data;
    config.booking.capacity = 1;
    assert.equal(
      (await admin.req("/admin/settings/booking", "PUT", config.booking))
        .status,
      200,
    );
    service = (await anon.req("/services")).data.find((s) => s.id === "bridal");
    const input = {
      ...bookingBody(),
      price: 1,
      deposit: 1,
      status: "paid",
      user_id: bob.user.id,
    };
    const created = await alice.req("/bookings", "POST", input);
    assert.equal(created.status, 201);
    booking = created.data;
    assert.equal(booking.price, service.price);
    assert.equal(booking.deposit, service.deposit);
    assert.equal(booking.user_id, alice.user.id);
    assert.equal(booking.status, "pending");
    const again = await alice.req("/bookings", "POST", input);
    assert.equal(again.data.id, booking.id);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM bookings").get()).n,
      1,
    );
    assert.equal(
      (await bob.req("/bookings", "POST", bookingBody())).status,
      409,
    );
    assert.equal(
      (await bob.req(`/bookings/${booking.id}/cancel`, "POST", {})).status,
      404,
    );
    assert.equal(
      (
        await bob.req("/payments/epay/create", "POST", {
          bookingId: booking.id,
          method: "alipay",
        })
      ).status,
      404,
    );
    const competing = await Promise.all([
      alice.req("/bookings", "POST", bookingBody("13:00")),
      bob.req("/bookings", "POST", bookingBody("13:00")),
    ]);
    assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
    const slots = (await anon.req(`/availability?date=${tomorrow}`)).data;
    assert.equal(slots.find((s) => s.time === "10:00").remaining, 0);
    const past = (await anon.req("/availability?date=2020-01-01")).data;
    assert.ok(past.every((s) => s.remaining === 0));
    const parallelInput = bookingBody("17:00");
    const retries = await Promise.all([
      alice.req("/bookings", "POST", parallelInput),
      alice.req("/bookings", "POST", parallelInput),
    ]);
    assert.deepEqual(retries.map((r) => r.status).sort(), [200, 201]);
    assert.equal(retries[0].data.id, retries[1].data.id);
  });
  await t.test("真实双端会话、越权防护与 SSE 推送", async () => {
    const ownBookings = await alice.req("/bookings");
    threadId = ownBookings.data.find(
      (b) => b.id === booking.id,
    ).conversation_id;
    assert.equal(
      (await bob.req(`/conversations/${threadId}/messages`)).status,
      404,
    );
    assert.equal(
      (
        await bob.req(`/conversations/${threadId}/messages`, "POST", {
          body: "越权",
        })
      ).status,
      404,
    );
    assert.ok(
      !(await bob.req("/conversations")).data.some((c) => c.id === threadId),
    );
    const abort = new AbortController();
    const response = await fetch(`${base}/events`, {
      headers: { cookie: alice.cookie },
      signal: abort.signal,
    });
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    assert.match(response.headers.get("cache-control"), /no-transform/);
    const reader = response.body.getReader();
    const initial = await reader.read();
    assert.match(new TextDecoder().decode(initial.value), /connected/);
    const sent = await admin.req(
      `/conversations/${threadId}/messages`,
      "POST",
      { body: "你好，欢迎预约壹梵。" },
    );
    assert.equal(sent.status, 201);
    const pushed = await reader.read();
    assert.match(new TextDecoder().decode(pushed.value), new RegExp(threadId));
    abort.abort();
    assert.equal(
      (await alice.req(`/conversations/${threadId}/messages`)).data[0]
        .sender_role,
      "admin",
    );
    let customerMessages = (await alice.req(`/conversations/${threadId}/messages`)).data;
    assert.equal(customerMessages[0].sender_name, "测试管理员");
    assert.equal(customerMessages[0].sender_title, "店主");
    assert.equal(
      (
        await admin.req(`/conversations/${threadId}/assignee`, "PATCH", {
          assigneeId: staffId,
        })
      ).status,
      200,
    );
    const customerThread = (await alice.req("/conversations")).data.find(
      (thread) => thread.id === threadId,
    );
    assert.equal(customerThread.assignee_name, "林老师");
    assert.equal(customerThread.assignee_title, "摄影师");
    assert.equal(
      (
        await staff.req(`/conversations/${threadId}/messages`, "POST", {
          body: "我会负责与你沟通拍摄风格。",
        })
      ).status,
      201,
    );
    customerMessages = (await alice.req(`/conversations/${threadId}/messages`)).data;
    assert.equal(customerMessages.length, 2);
    assert.equal(customerMessages[1].sender_name, "林老师");
    assert.equal(customerMessages[1].sender_title, "摄影师");
  });
  await t.test("易支付设置、签名、金额校验、伪回调拒绝与幂等到账", async () => {
    assert.equal(
      (
        await alice.req("/payments/epay/create", "POST", {
          bookingId: booking.id,
          method: "alipay",
        })
      ).status,
      503,
    );
    assert.equal(
      (
        await admin.req("/admin/settings/epay", "PUT", {
          enabled: true,
          gateway: "http://pay.invalid/",
          pid: "1001",
          secret: "test-merchant-secret",
          methods: ["alipay"],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await admin.req("/admin/settings/epay", "PUT", {
          enabled: true,
          gateway: "https://pay.example.com/",
          pid: "1001",
          secret: "test-merchant-secret",
          methods: ["alipay"],
        })
      ).status,
      200,
    );
    const publicSettings = await anon.req("/settings");
    assert.equal(publicSettings.data.payment.available, true);
    assert.ok(!JSON.stringify(publicSettings.data).includes("secret"));
    const privateSettings = await admin.req("/admin/settings");
    assert.equal(privateSettings.data.epay.secret, "");
    assert.equal(privateSettings.data.epay.hasSecret, true);
    assert.ok(
      !(
        await db
          .prepare("SELECT value FROM settings WHERE setting_key='epay'")
          .get()
      ).value.includes("test-merchant-secret"),
    );
    const created = await alice.req("/payments/epay/create", "POST", {
      bookingId: booking.id,
      method: "alipay",
      amount: 1,
    });
    assert.equal(created.status, 200);
    const parallelPayments = await Promise.all([
      alice.req("/payments/epay/create", "POST", {
        bookingId: booking.id,
        method: "alipay",
      }),
      alice.req("/payments/epay/create", "POST", {
        bookingId: booking.id,
        method: "alipay",
      }),
    ]);
    assert.ok(
      parallelPayments.every(
        (r) => r.status === 200 && r.data.paymentId === created.data.paymentId,
      ),
    );
    const url = new URL(created.data.url);
    payment = Object.fromEntries(url.searchParams);
    assert.equal(payment.money, (service.deposit / 100).toFixed(2));
    assert.equal(url.pathname, "/submit.php");
    assert.equal(payment.sign, signEpay(payment, "test-merchant-secret"));
    assert.equal(
      (await alice.req(`/bookings/${booking.id}/cancel`, "POST", {})).status,
      409,
    );
    const callback = {
      pid: "1001",
      out_trade_no: payment.out_trade_no,
      trade_no: "TEST_TRADE_001",
      money: payment.money,
      trade_status: "TRADE_SUCCESS",
      sign_type: "MD5",
    };
    async function notify(value) {
      return fetch(
        `${base}/payments/epay/notify?${new URLSearchParams(value)}`,
      );
    }
    let response = await notify({ ...callback, sign: "forged" });
    assert.equal(response.status, 400);
    assert.equal(await response.text(), "fail");
    const wrong = { ...callback, money: "0.01" };
    wrong.sign = signEpay(wrong, "test-merchant-secret");
    assert.equal((await notify(wrong)).status, 400);
    assert.equal(
      (
        await db
          .prepare("SELECT status FROM bookings WHERE id=?")
          .get(booking.id)
      ).status,
      "pending",
    );
    callback.sign = signEpay(callback, "test-merchant-secret");
    response = await notify(callback);
    assert.equal(await response.text(), "success");
    response = await notify(callback);
    assert.equal(await response.text(), "success");
    assert.equal(
      (
        await db
          .prepare("SELECT status FROM bookings WHERE id=?")
          .get(booking.id)
      ).status,
      "paid",
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM audit_logs WHERE action='payment.received'",
          )
          .get()
      ).n,
      1,
    );
    assert.equal(moneyToCents("1.01"), 101);
    assert.equal(moneyToCents("1e2"), null);
    assert.equal(moneyToCents("1.001"), null);
    assert.equal(
      (
        await admin.req(`/admin/bookings/${booking.id}`, "PATCH", {
          status: "completed",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await admin.req(`/admin/bookings/${booking.id}`, "PATCH", {
          status: "confirmed",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await admin.req(`/admin/bookings/${booking.id}`, "PATCH", {
          status: "completed",
        })
      ).status,
      200,
    );
  });
  await t.test("过期订单释放容量、迟到付款进入待核对且不复占名额", async () => {
    const b = (await bob.req("/bookings", "POST", bookingBody("15:00"))).data;
    const pay = (
      await bob.req("/payments/epay/create", "POST", {
        bookingId: b.id,
        method: "alipay",
      })
    ).data;
    const p = Object.fromEntries(new URL(pay.url).searchParams);
    await db
      .prepare("UPDATE bookings SET expires_at=? WHERE id=?")
      .run(Date.now() - 1, b.id);
    await maintenance(db);
    assert.equal(
      (await db.prepare("SELECT status FROM bookings WHERE id=?").get(b.id))
        .status,
      "expired",
    );
    assert.equal(
      (await anon.req(`/availability?date=${tomorrow}`)).data.find(
        (s) => s.time === "15:00",
      ).remaining,
      1,
    );
    const replacement = await alice.req(
      "/bookings",
      "POST",
      bookingBody("15:00"),
    );
    assert.equal(replacement.status, 201);
    const cb = {
      pid: "1001",
      out_trade_no: p.out_trade_no,
      trade_no: "TEST_LATE_002",
      money: p.money,
      trade_status: "TRADE_SUCCESS",
      sign_type: "MD5",
    };
    cb.sign = signEpay(cb, "test-merchant-secret");
    assert.equal(
      await (
        await fetch(`${base}/payments/epay/notify?${new URLSearchParams(cb)}`)
      ).text(),
      "success",
    );
    assert.equal(
      (await db.prepare("SELECT status FROM bookings WHERE id=?").get(b.id))
        .status,
      "refund_review",
    );
    assert.equal(
      (await anon.req(`/availability?date=${tomorrow}`)).data.find(
        (s) => s.time === "15:00",
      ).remaining,
      0,
    );
  });
  await t.test("社区发帖、回复、点赞、审核与所有者删除", async () => {
    const created = await alice.req("/posts", "POST", {
      title: "我的婚纱灵感",
      category: "婚纱灵感",
      body: "<script>alert(1)</script> 期待自然光拍摄。",
    });
    assert.equal(created.status, 201);
    const postId = created.data.id;
    assert.equal((await bob.req(`/posts/${postId}`, "DELETE", {})).status, 404);
    assert.equal(
      (
        await bob.req(`/posts/${postId}/comments`, "POST", {
          body: "一起期待！",
        })
      ).status,
      201,
    );
    await bob.req(`/posts/${postId}/like`, "POST", {});
    await bob.req(`/posts/${postId}/like`, "POST", {});
    const detail = (await alice.req(`/posts/${postId}`)).data;
    assert.equal(detail.like_count, 0);
    assert.equal(detail.comment_count, 1);
    assert.match(detail.body, /<script>/);
    assert.equal(
      (await alice.req(`/admin/posts/${postId}`, "PATCH", { hidden: true }))
        .status,
      403,
    );
    assert.equal(
      (await admin.req(`/admin/posts/${postId}`, "PATCH", { hidden: true }))
        .status,
      200,
    );
    assert.equal((await anon.req(`/posts/${postId}`)).status, 404);
    assert.equal((await anon.req("/posts")).data.total, 0);
    await admin.req(`/admin/posts/${postId}`, "PATCH", { hidden: false });
    assert.equal((await anon.req("/posts?category=婚纱灵感")).data.total, 1);
    assert.equal(
      (await alice.req(`/posts/${postId}`, "DELETE", {})).status,
      200,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS n FROM comments WHERE post_id=?")
          .get(postId)
      ).n,
      0,
    );
  });
  await t.test("180 天强制过滤与物理清理，保留订单财务资料", async () => {
    const oldId = randomUUID();
    await db
      .prepare(
        "INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)",
      )
      .run(
        oldId,
        threadId,
        alice.user.id,
        "旧消息",
        Date.now() - 181 * 86400000,
      );
    const retainedId = randomUUID();
    await db
      .prepare(
        "INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)",
      )
      .run(
        retainedId,
        threadId,
        alice.user.id,
        "保留消息",
        Date.now() - 179 * 86400000,
      );
    const rows = (await alice.req(`/conversations/${threadId}/messages`)).data;
    assert.ok(!rows.some((m) => m.id === oldId));
    assert.ok(rows.some((m) => m.id === retainedId));
    await maintenance(db);
    assert.equal(
      await db.prepare("SELECT id FROM messages WHERE id=?").get(oldId),
      undefined,
    );
    assert.ok(
      await db.prepare("SELECT id FROM messages WHERE id=?").get(retainedId),
    );
    assert.ok(
      await db.prepare("SELECT id FROM bookings WHERE id=?").get(booking.id),
    );
  });
  await t.test("同毫秒历史消息分页不遗漏，拒绝其他会话游标", async () => {
    const created = Date.now() - 1000;
    for (let i = 0; i < 151; i++)
      await db
        .prepare(
          "INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)",
        )
        .run(randomUUID(), threadId, alice.user.id, `同毫秒消息 ${i}`, created);
    const latest = (await alice.req(`/conversations/${threadId}/messages`))
      .data;
    assert.equal(latest.length, 100);
    const earlier = (
      await alice.req(
        `/conversations/${threadId}/messages?before=${latest[0].id}`,
      )
    ).data;
    const seen = new Set([...latest, ...earlier].map((m) => m.id));
    const count = (
      await db
        .prepare("SELECT COUNT(*) AS n FROM messages WHERE conversation_id=?")
        .get(threadId)
    ).n;
    assert.equal(seen.size, Number(count));
    assert.equal(
      (
        await bob.req(
          `/conversations/${threadId}/messages?before=${latest[0].id}`,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await alice.req(
          `/conversations/${threadId}/messages?before=${randomUUID()}`,
        )
      ).status,
      404,
    );
  });
  await t.test("品牌主题仅管理员可设置，验证方案、保存持久化且兼容旧客户端", async () => {
    const site = (await admin.req("/admin/settings")).data.site;
    assert.equal((await alice.req("/admin/settings/site", "PUT", {...site, defaultTheme: "noir"})).status, 403);
    assert.equal((await admin.req("/admin/settings/site", "PUT", {...site, defaultTheme: "unknown-theme"})).status, 400);
    for (const defaultTheme of ["ivory", "rose", "sage", "noir"]) {
      assert.equal((await admin.req("/admin/settings/site", "PUT", {...site, defaultTheme})).status, 200);
      assert.equal((await alice.req("/settings")).data.site.defaultTheme, defaultTheme);
      assert.equal(JSON.parse((await db.prepare("SELECT value FROM settings WHERE setting_key='site'").get()).value).defaultTheme, defaultTheme);
    }
    const {defaultTheme: _oldTheme, ...legacySite} = site;
    assert.equal((await admin.req("/admin/settings/site", "PUT", legacySite)).status, 200);
    assert.equal((await alice.req("/settings")).data.site.defaultTheme, "noir");
    await admin.req("/admin/settings/site", "PUT", {...site, defaultTheme: "ivory"});
  });
  await t.test("套餐编辑、档期输入校验及退出后会话失效", async () => {
    assert.equal(
      (
        await admin.req(`/admin/services/${service.id}`, "PUT", {
          ...service,
          deposit: service.price + 1,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await admin.req(`/admin/services/${service.id}`, "PUT", {
          ...service,
          price: service.price + 10000,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT price FROM bookings WHERE id=?")
          .get(booking.id)
      ).price,
      service.price,
    );
    const config = (await admin.req("/admin/settings")).data.booking;
    assert.equal(
      (
        await admin.req("/admin/settings/booking", "PUT", {
          ...config,
          times: ["10:00", "10:00"],
        })
      ).status,
      400,
    );
    const oldCookie = alice.cookie;
    await alice.req("/auth/logout", "POST", {});
    assert.equal(
      (await alice.req("/bookings", "GET", undefined, { cookie: oldCookie }))
        .status,
      401,
    );
  });
});
