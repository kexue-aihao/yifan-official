import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { createTranslator } from "next-intl";
import { locales } from "../../i18n/locales.mjs";
import {randomUUID} from "node:crypto";
import mysql from "mysql2/promise";

const messageIndex = JSON.parse(readFileSync("i18n/source-map.json", "utf8"));
const translated = (locale: string) => {
  const t = createTranslator({
    locale,
    messages: JSON.parse(readFileSync(`i18n/messages/${locale}.json`, "utf8")),
    namespace: "copy",
  });
  return (source: string) => t(messageIndex[source]);
};
test.describe.configure({ mode: "serial" });

test("首次访问 /install：真实数据库校验通过才允许配置管理员，完成后安装锁生效", async ({
  page,
}) => {
  test.setTimeout(60000);
  const fixture = JSON.parse(readFileSync("artifacts/ui-fixture.json", "utf8"));
  const en = translated("en");
  await page.goto("/en/install");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByLabel(en("安装密钥"), { exact: true }).fill("incorrect-key");
  await page.getByRole("button", { name: en("开始配置") }).click();
  await expect(page.locator(".error-notice")).toHaveText(
    en("安装密钥不正确，请查看服务器 data/install.key 文件。"),
  );
  await page
    .getByRole("combobox", { name: en("选择语言") })
    .selectOption("zh-CN");
  await expect(page).toHaveURL(/\/install$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/install$/);
  await page.getByLabel("安装密钥", { exact: true }).fill(fixture.key);
  await page.getByRole("button", { name: "开始配置" }).click();
  await page
    .getByLabel("数据库主机", { exact: true })
    .fill(fixture.connection.host);
  await page
    .getByLabel("端口", { exact: true })
    .fill(String(fixture.connection.port));
  await page
    .getByLabel("数据库用户名", { exact: true })
    .fill(fixture.connection.user);
  await page
    .getByLabel("数据库密码", { exact: true })
    .fill(fixture.connection.password);
  await page
    .getByLabel("已创建的数据库名称", { exact: true })
    .fill("yf_missing_browser_database");
  const next = page.getByRole("button", { name: "下一步" });
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "核实数据库", exact: true }).click();
  await expect(page.locator(".error-notice")).toContainText("不存在");
  await expect(next).toBeDisabled();
  await page
    .getByLabel("已创建的数据库名称", { exact: true })
    .fill(fixture.connection.database);
  await page.getByRole("button", { name: "核实数据库", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("数据库真实性核实通过");
  await expect(next).toBeEnabled();
  await page.getByLabel("数据库主机", { exact: true }).fill("localhost");
  await expect(next).toBeDisabled();
  await page
    .getByLabel("数据库主机", { exact: true })
    .fill(fixture.connection.host);
  await page.getByRole("button", { name: "核实数据库", exact: true }).click();
  await expect(next).toBeEnabled();
  await page.screenshot({
    path: "artifacts/install-database-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/install-database-mobile.png",
    fullPage: true,
  });
  await next.click();
  await page.getByLabel("管理员称呼", { exact: true }).fill("测试管理员");
  await page
    .getByLabel("管理员邮箱", { exact: true })
    .fill("browser-admin@example.com");
  await page.getByLabel("管理员密码", { exact: true }).fill("BrowserAdmin123!");
  await page.getByLabel("确认密码", { exact: true }).fill("BrowserAdmin123!");
  await page.getByRole("button", { name: "完成安装", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "壹梵，已准备就绪。" }),
  ).toBeVisible({ timeout: 30000 });
  await page.goto("/install");
  await expect(
    page.getByRole("heading", { name: "网站已完成安装" }),
  ).toBeVisible();
});

test("桌面与手机视觉、导航、作品筛选", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "爱的形状，由你定义。" }),
  ).toBeVisible();
  await expect(page.locator(".hero-image")).toHaveJSProperty("complete", true);
  mkdirSync("artifacts", { recursive: true });
  await page.locator("#our-story").scrollIntoViewIfNeeded();
  await expect(page.locator(".atelier-story-photo>img")).toHaveJSProperty(
    "complete",
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "下一张影像" }).click();
  await expect(
    page.getByRole("heading", { name: "让心动，有迹可循。" }),
  ).toBeVisible();
  await page.goto("/portfolio");
  await page.getByRole("button", { name: "个人写真", exact: true }).click();
  await expect(page.locator(".gallery-item")).toHaveCount(1);
  await page.locator(".gallery-item").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".cinema-curtain")).toHaveCSS(
    "transform",
    "matrix(0, 0, 0, 1, 0, 0)",
  );
  await expect(page.locator(".cinema-actions")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: "打开导航" })).toBeVisible();
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "打开导航" }).click();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "定制服务" })
    .click();
  await expect(page.locator(".package-card")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/services-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("客服只确认可视消息，滚动和加载更早历史后分别产生回执", async ({page, browser}) => {
  const origin = "http://127.0.0.1:4174";
  const fixture = JSON.parse(readFileSync("artifacts/ui-fixture.json", "utf8"));
  const account = await page.request.post("/api/auth/register", {
    headers: {origin},
    data: {name: "历史回执顾客", email: `history-${Date.now()}@example.com`, password: "HistoryCustomer123!", consent: true},
  }).then(r => r.json());
  const thread = await page.request.post("/api/conversations", {
    headers: {origin, "x-csrf-token": account.csrf}, data: {},
  }).then(r => r.json());
  const ids = Array.from({length: 105}, () => randomUUID());
  const db = await mysql.createConnection(fixture.connection);
  try {
    await db.query("INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES ?", [
      ids.map((id, index) => [id, thread.id, account.user.id, index === 104
        ? "一条超过消息视区高度的长消息。".repeat(130) : `历史消息 ${index}`, Date.now() - 105 + index]),
    ]);
  } finally {await db.end();}
  const context = await browser.newContext({locale: "zh-CN"});
  const admin = await context.newPage();
  try {
    await admin.goto(origin + "/login?next=/admin");
    await admin.getByRole("textbox", {name: "邮箱地址"}).fill("browser-admin@example.com");
    await admin.locator("input[name=password]").fill("BrowserAdmin123!");
    await admin.getByRole("button", {name: "登录壹梵"}).click();
    await admin.getByRole("button", {name: "客服收件箱"}).click();
    await expect(admin.locator(".message-bubble")).toHaveCount(100);
    const list = admin.locator(".message-list");
    const history = (before?: string) => page.request.get(`/api/conversations/${thread.id}/messages${before ? `?before=${before}` : ""}`).then(r => r.json());
    const receipt = async (id: string) => (await history()).find((m: {id: string}) => m.id === id)?.staff_read_at;
    await expect.poll(() => receipt(ids[104])).toBeGreaterThan(0);
    expect(await receipt(ids[5])).toBeNull();
    expect((await history(ids[5])).find((m: {id: string}) => m.id === ids[0]).staff_read_at).toBeNull();
    await list.evaluate(el => {el.scrollTop = 0;});
    await expect.poll(() => receipt(ids[5])).toBeGreaterThan(0);
    expect((await history(ids[5])).find((m: {id: string}) => m.id === ids[0]).staff_read_at).toBeNull();
    await admin.getByRole("button", {name: "查看更早消息"}).click();
    await expect(admin.locator(".message-bubble")).toHaveCount(105);
    await list.evaluate(el => {el.scrollTop = 0;});
    await expect.poll(async () => (await history(ids[5])).find((m: {id: string}) => m.id === ids[0]).staff_read_at).toBeGreaterThan(0);
  } finally {await context.close();}
});

test("英语注册预约、语言切换保留查询和锚点、原始顾客内容保持不变", async ({
  page,
}) => {
  const en = translated("en"),
    fr = translated("fr");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "/en/services?category=" + encodeURIComponent("婚纱拍摄") + "#main",
  );
  await expect(page.locator(".package-card")).toHaveCount(1);
  await expect(page.locator(".package-card h2")).toHaveText(en("婚纱摄影"));
  await expect(page.locator(".package-price strong")).toContainText("CNY");
  await page.getByRole("combobox", { name: en("选择语言") }).selectOption("fr");
  await expect(page).toHaveURL(/\/fr\/services\?category=.*#main$/);
  await expect(page.locator(".package-card")).toHaveCount(1);
  await page.getByRole("combobox", { name: fr("选择语言") }).selectOption("en");
  await expect(page).toHaveURL(/\/en\/services/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: en("预约专属体验") }).click();
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  await page.getByRole("link", { name: en("注册，开启美好") }).click();
  await page.locator("input[name=name]").fill("花影 · Alex");
  await page
    .locator("input[name=email]")
    .fill(`locale-${Date.now()}@example.com`);
  await page.locator("input[name=password]").fill("GlobalCustomer123!");
  await page.locator("input[name=consent]").check();
  await page.getByRole("button", { name: en("创建我的账户") }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /13:00/ }).click();
  await dialog.locator("input[name=phone]").fill("+8613900000000");
  await dialog
    .locator("textarea[name=note]")
    .fill("请保留这段原文 · My original request.");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: en("确认预约，前往订单") }).click();
  await expect(page).toHaveURL(/\/en\/account\?new=1/);
  await expect(page.locator(".booking-card h2")).toHaveText(en("婚纱摄影"));
  await expect(page.locator(".booking-note")).toContainText(
    "请保留这段原文 · My original request.",
  );
  await page.getByRole("combobox", { name: en("选择语言") }).selectOption("ar");
  await expect(page).toHaveURL(/\/ar\/account\?new=1/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".booking-note")).toContainText(
    "请保留这段原文 · My original request.",
  );
  await page.getByRole("combobox").selectOption("en");
  await expect(page).toHaveURL(/\/en\/account/);
  await page.goto("/account?payment=returned");
  await expect(page).toHaveURL(/\/en\/account\?payment=returned$/);
  await expect(page.locator(".booking-card")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("11种语言服务端渲染、语言检测、RTL手机布局及本地化404", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const locale of locales) {
    await page.goto(`${locale === "zh-CN" ? "" : "/" + locale}/services`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      locale === "ar" ? "rtl" : "ltr",
    );
    await expect(page.locator(".package-card")).toHaveCount(6);
    if (!["zh-CN", "zh-TW", "ja"].includes(locale)) {
      const systemText = (await page.locator("body").innerText()).replace(
        /壹梵定制|简体中文|繁體中文|日本語/g,
        "",
      );
      expect(systemText, locale).not.toMatch(/\p{Script=Han}/u);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/services");
  await expect(page.locator(".package-card img").first()).toHaveJSProperty(
    "complete",
    true,
  );
  await expect(page.locator(".route-stage")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/services-ar-mobile.png",
    fullPage: true,
  });
  await page.goto("/ar");
  await expect(page.locator(".cinema-actions")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/home-ar-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en");
  await expect(page.locator(".cinema-curtain")).toHaveCSS(
    "transform",
    "matrix(0, 0, 0, 1, 0, 0)",
  );
  await expect(page.locator(".cinema-actions")).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero-image")).toHaveJSProperty("complete", true);
  await page.screenshot({
    path: "artifacts/home-en-desktop.png",
    fullPage: true,
  });
  const response = await page.goto("/en/not-a-page");
  // Next.js keeps 200 after streaming has started and adds noindex for notFound().
  expect([200, 404]).toContain(response?.status());
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    "noindex",
  );
  await expect(page.getByRole("heading")).toHaveText(
    translated("en")("这一页，暂未定格。"),
  );
  const context = await browser.newContext({ locale: "fr-CA" });
  const detected = await context.newPage();
  await detected.goto("http://127.0.0.1:4174/services");
  await expect(detected).toHaveURL(/\/fr\/services$/);
  await expect(detected.locator("html")).toHaveAttribute("lang", "fr");
  await context.close();
  expect(errors).toEqual([]);
});

test("注册 → 预约 → 会话 → 发帖回复 → 管理员接待与设置", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/services");
  await page.getByRole("button", { name: "预约专属体验" }).first().click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("link", { name: "注册，开启美好" }).click();
  await page.getByRole("textbox", { name: "你的称呼" }).fill("小梵");
  await page
    .getByRole("textbox", { name: "邮箱地址" })
    .fill(`browser-${Date.now()}@example.com`);
  await page.locator("input[name=password]").fill("CustomerTest123!");
  await page.locator("input[name=consent]").check();
  await page.getByRole("button", { name: "创建我的账户" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /10:00/ }).click();
  await dialog.getByRole("textbox", { name: "联系电话" }).fill("13800000000");
  await dialog
    .getByRole("textbox", { name: /想与我们分享/ })
    .fill("想尝试自然纪实风格。");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "确认预约，前往订单" }).click();
  await expect(page).toHaveURL(/\/account\?new=1/);
  await expect(
    page.getByText("待付订金", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.locator(".booking-read-status")).toHaveText("待工作人员查看");
  await page.getByRole("button", { name: "支付订金" }).click();
  await expect(
    page.getByRole("heading", { name: "在线支付尚未开通" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "联系顾问", exact: true }).click();
  await expect(page.locator(".chat-panel")).toBeVisible();
  await page
    .getByRole("textbox", { name: "消息内容" })
    .fill("你好，请问拍摄可以自带礼服吗？");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(
    page.locator(".message-bubble").filter({ hasText: "自带礼服" }),
  ).toBeVisible();
  const customerMessage = page.locator(".message").filter({hasText: "自带礼服"});
  await expect(customerMessage.locator(".message-receipt")).toHaveText("已发送");
  const adminContext = await browser.newContext({ locale: "zh-CN" });
  const admin = await adminContext.newPage();
  await admin.goto("http://127.0.0.1:4174/login?next=/admin");
  await admin
    .getByRole("textbox", { name: "邮箱地址" })
    .fill("browser-admin@example.com");
  await admin.locator("input[name=password]").fill("BrowserAdmin123!");
  await admin.getByRole("button", { name: "登录壹梵" }).click();
  await expect(
    admin.getByRole("heading", { name: "品牌工作台" }),
  ).toBeVisible();
  await admin.bringToFront();
  await admin.getByRole("button", {name: "预约管理", exact: true}).click();
  const order = admin.locator(".admin-order").filter({hasText: "小梵"});
  await expect(order.locator(".booking-read-status")).toHaveText("待工作人员查看");
  // Fetching the full list must leave every booking untouched.
  expect((await page.request.get("/api/bookings").then(r => r.json()))[0].staff_viewed_at).toBeNull();
  await order.getByRole("button", {name: "查看预约详情"}).click();
  await expect(admin.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".booking-read-status")).toContainText("工作人员已查看 ·");
  const firstView = (await page.request.get("/api/bookings").then(r => r.json()))[0].staff_viewed_at;
  await admin.keyboard.press("Escape");
  await order.getByRole("button", {name: "查看预约详情"}).click();
  await expect(admin.getByRole("dialog").locator(".booking-read-status")).toHaveText("工作人员已查看");
  expect((await page.request.get("/api/bookings").then(r => r.json()))[0].staff_viewed_at).toBe(firstView);
  await admin.keyboard.press("Escape");
  await expect(admin.locator(".admin-order").filter({hasText: "花影 · Alex"}).locator(".booking-read-status"))
    .toHaveText("待工作人员查看");
  await admin.getByRole("button", { name: "客服收件箱" }).click();
  await expect(
    admin
      .locator(".inbox-conversation .message-bubble")
      .filter({ hasText: "自带礼服" }),
  ).toBeVisible();
  await expect(customerMessage.locator(".message-receipt")).toHaveText("工作人员已读");
  // Keep the staff page open in the background while a new message arrives.
  // Headless Chrome emulates focus for each context, so supply the browser's
  // background signal explicitly while continuing real requests and rendering.
  await admin.evaluate(() => {
    Object.defineProperty(document, "hasFocus", {configurable: true, value: () => false});
    window.dispatchEvent(new Event("blur"));
  });
  await page.getByRole("textbox", {name: "消息内容"}).fill("后台窗口未激活时，请保持未读。");
  await page.getByRole("button", {name: "发送消息"}).click();
  const backgroundMessage = page.locator(".message").filter({hasText: "后台窗口未激活"});
  await expect(admin.locator(".message-bubble").filter({hasText: "后台窗口未激活"})).toBeVisible();
  await expect(backgroundMessage.locator(".message-receipt")).toHaveText("已发送");
  // A round trip after rendering confirms the status is stored, not just delayed UI.
  const thread = (await page.request.get("/api/bookings").then(r => r.json()))[0].conversation_id;
  expect((await page.request.get(`/api/conversations/${thread}/messages`).then(r => r.json())).at(-1).staff_read_at).toBeNull();
  await admin.evaluate(() => {
    Reflect.deleteProperty(document, "hasFocus");
    window.dispatchEvent(new Event("focus"));
  });
  await expect(backgroundMessage.locator(".message-receipt")).toHaveText("工作人员已读");
  await page.screenshot({path: "artifacts/customer-read-receipts.png", fullPage: true});
  await admin
    .getByRole("textbox", { name: "消息内容" })
    .fill("可以，我们会提前沟通搭配。");
  await admin.getByRole("button", { name: "发送消息" }).click();
  await expect(
    page.locator(".message-bubble").filter({ hasText: "提前沟通搭配" }),
  ).toBeVisible();
  await admin.screenshot({ path: "artifacts/admin-inbox.png", fullPage: true });
  await page.getByRole("button", { name: "关闭客服会话" }).click();
  await page.goto("/community");
  await page.getByRole("button", { name: "写下我的故事" }).click();
  await page
    .getByRole("textbox", { name: "给故事一个标题" })
    .fill("第一次拍摄的自然光灵感");
  await page
    .getByRole("textbox", { name: "分享内容" })
    .fill(
      "喜欢自然纪实风格，也想听听大家的搭配建议。<script>window.bad=true</script>",
    );
  await page.getByRole("button", { name: "发布我的故事" }).click();
  await expect(
    page.getByRole("heading", { name: "第一次拍摄的自然光灵感" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { bad?: boolean }).bad),
  ).toBeUndefined();
  await page
    .getByRole("textbox", { name: "你的回应" })
    .fill("期待拍出属于自己的故事。");
  await page.getByRole("button", { name: "发布回复" }).click();
  await expect(page.locator(".comment")).toHaveCount(1);
  await page.getByRole("button", { name: "0 人喜欢" }).click();
  await expect(page.getByRole("button", { name: "1 人喜欢" })).toBeVisible();
  await admin.getByRole("button", { name: "定制服务", exact: true }).click();
  await admin.getByRole("button", { name: "编辑婚纱摄影" }).click();
  await admin.getByRole("spinbutton", { name: "套餐价格（元）" }).fill("3999");
  await admin.getByRole("button", { name: "保存服务" }).click();
  await expect(admin.getByText("服务已保存", { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: "档期设置" }).click();
  await admin.getByRole("spinbutton", { name: "每时段容量" }).fill("3");
  await admin.getByRole("button", { name: "保存档期设置" }).click();
  await expect(
    admin.getByText("预约档期已更新", { exact: true }),
  ).toBeVisible();
  await admin.getByRole("button", { name: "品牌与支付" }).click();
  await expect(
    admin.getByRole("heading", { name: "易支付 Epay" }),
  ).toBeVisible();
  await admin.getByRole("textbox", { name: "联系电话" }).fill("400-123-4567");
  await admin.getByRole("button", { name: "保存品牌资料" }).click();
  await expect(
    admin.getByText("品牌资料已更新", { exact: true }),
  ).toBeVisible();
  await admin.screenshot({
    path: "artifacts/admin-settings.png",
    fullPage: true,
  });
  await admin.getByRole("button", { name: "社区管理" }).click();
  await admin.getByRole("button", { name: "隐藏帖子" }).click();
  await expect(admin.getByRole("button", { name: "恢复展示" })).toBeVisible();
  await adminContext.close();
  expect(errors).toEqual([]);
});
