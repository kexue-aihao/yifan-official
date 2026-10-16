import { test, expect, type BrowserContext } from "@playwright/test";
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
  test.setTimeout(180000);
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
  await expect(page.getByRole("status")).toContainText("数据库真实性核实通过", {timeout: 30000});
  await expect(next).toBeEnabled({timeout: 30000});
  await page.getByLabel("数据库主机", { exact: true }).fill("localhost");
  await expect(next).toBeDisabled();
  await page
    .getByLabel("数据库主机", { exact: true })
    .fill(fixture.connection.host);
  await page.getByRole("button", { name: "核实数据库", exact: true }).click();
  await expect(next).toBeEnabled({timeout: 30000});
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
  ).toBeVisible({ timeout: 90000 });
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
  // The theme studio obscures the inbox; incoming messages remain unread until it closes.
  await admin.getByRole("button", {name: "切换主题", exact: true}).click();
  await expect(admin.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", {name: "消息内容"}).fill("主题面板遮挡时，请保持未读。");
  await page.getByRole("button", {name: "发送消息"}).click();
  const coveredMessage = page.locator(".message").filter({hasText: "主题面板遮挡"});
  await expect(admin.locator(".message-bubble").filter({hasText: "主题面板遮挡"})).toBeAttached();
  await expect(coveredMessage.locator(".message-receipt")).toHaveText("已发送");
  expect((await page.request.get(`/api/conversations/${thread}/messages`).then(r => r.json())).at(-1).staff_read_at).toBeNull();
  await admin.keyboard.press("Escape");
  await expect(coveredMessage.locator(".message-receipt")).toHaveText("工作人员已读");
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

test("四套品牌主题即时切换、表单保留、Cookie首屏及手机RTL适配", async ({page, browser}) => {
  test.setTimeout(90000);
  const choices = [{id: "ivory", name: "象牙香槟"}, {id: "rose", name: "玫瑰雾粉"}, {id: "sage", name: "翡翠雅绿"}, {id: "noir", name: "午夜鎏金"}];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  mkdirSync("artifacts/themes", {recursive: true});
  await page.goto("/services");
  for (const theme of choices) {
    await page.getByRole("button", {name: "切换主题", exact: true}).click();
    const studio = page.getByRole("dialog", {name: "选择你的壹梵主题"});
    await studio.getByRole("button", {name: theme.name, exact: true}).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.id);
    await expect(studio.getByRole("button", {name: theme.name, exact: true})).toHaveAttribute("aria-pressed", "true");
    await studio.getByRole("button", {name: "完成", exact: true}).click();
    await expect(page.locator(".package-card")).toHaveCount(6);
    const serviceLayouts = {ivory: 'service-cards', rose: 'service-chapters', sage: 'service-directory', noir: 'service-lookbook'} as const;
    await expect(page.locator(`[data-layout="${serviceLayouts[theme.id as keyof typeof serviceLayouts]}"]`)).toBeVisible();
    const composition=await page.locator('.package-card').first().evaluate(card=>{
      const image=card.querySelector('.image-wrap')!.getBoundingClientRect();
      const content=card.querySelector('.package-content')!.getBoundingClientRect();
      return {sideBySide:content.x>=image.right-1,imageWidth:image.width};
    });
    expect(composition.sideBySide).toBe(theme.id!=='ivory');
    await expect(page.locator(".route-stage")).toHaveCSS("opacity", "1");
    await page.screenshot({path: `artifacts/themes/${theme.id}-services-desktop.png`, fullPage: true, animations: "disabled"});
    const html = await page.request.get("/services").then(r => r.text());
    expect(html).toContain(`data-theme="${theme.id}"`);
    await page.goto("/");
    const layouts = {ivory: 'cinematic-narrative', rose: 'romantic-collage', sage: 'studio-index', noir: 'couture-editorial'} as const;
    await expect(page.locator('[data-layout="'+layouts[theme.id as keyof typeof layouts]+'"]')).toBeVisible();
    if(theme.id!=='ivory')await expect(page.locator('.hero-image')).toHaveCSS('position','static');
    await page.screenshot({path: `artifacts/themes/${theme.id}-home-desktop.png`, animations: "disabled"});
    await page.goto('/portfolio');
    await expect(page.locator(`[data-layout="gallery-${theme.id}"]`)).toBeVisible();
    await expect(page.locator('.gallery-item')).toHaveCount(8);
    await page.screenshot({path:`artifacts/themes/${theme.id}-portfolio-desktop.png`,fullPage:true,animations:'disabled'});
    await page.locator('.gallery-item').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto("/services");
  }
  await page.goto("/login");
  await page.getByRole("textbox", {name: "邮箱地址"}).fill("theme-draft@example.com");
  await page.getByRole("button", {name: "切换主题", exact: true}).click();
  await page.getByRole("dialog").getByRole("button", {name: "玫瑰雾粉", exact: true}).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", {name: "邮箱地址"})).toHaveValue("theme-draft@example.com");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "rose");
  const noScript = await browser.newContext({javaScriptEnabled: false, locale: "en"});
  await noScript.addCookies([{name: "YF_THEME", value: "noir", url: "http://127.0.0.1:4174"}]);
  const staticPage = await noScript.newPage();
  await staticPage.goto("http://127.0.0.1:4174/en/login");
  await expect(staticPage.locator("html")).toHaveAttribute("data-theme", "noir");
  await expect(staticPage.locator("body")).toHaveCSS("background-color", "rgb(23, 26, 27)");
  await noScript.addCookies([{name: "YF_THEME", value: "unsupported-theme", url: "http://127.0.0.1:4174"}]);
  await staticPage.reload();
  await expect(staticPage.locator("html")).toHaveAttribute("data-theme", "ivory");
  await noScript.close();
  await page.setViewportSize({width: 320, height: 850});
  await page.goto("/ar/services");
  const ar = translated("ar");
  for (const theme of choices) {
    await page.getByRole("button", {name: ar("切换主题"), exact: true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", {name: ar(theme.name), exact: true}).click();
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.screenshot({path: `artifacts/themes/${theme.id}-studio-ar-mobile.png`, animations: "disabled"});
    await dialog.getByRole("button", {name: ar("完成"), exact: true}).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/ar/');
    await expect(page.locator('.hero-image')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`artifacts/themes/${theme.id}-home-ar-mobile.png`,fullPage:true,animations:'disabled'});
    await page.goto('/ar/services');
  }
  expect(errors).toEqual([]);
});

test('后台访问统计可搜索注册 ID，并显示预约会话的真实 IP 记录',async({page})=>{
  await page.goto('/login?next=/admin');
  await page.getByRole('textbox',{name:'邮箱地址'}).fill('browser-admin@example.com');
  await page.locator('input[name=password]').fill('BrowserAdmin123!');
  await page.getByRole('button',{name:'登录壹梵',exact:true}).click();
  await page.getByRole('button',{name:'访问与 IP',exact:true}).click();
  await expect(page.locator('.visitor-ip-list article')).not.toHaveCount(0);
  await expect(page.locator('.visitor-ip-list')).toContainText('内网 / 本机');
  await page.getByRole('button',{name:'查看访问明细',exact:true}).first().click();
  await expect(page.locator('.visitor-event-list')).toContainText('注册 ID');
  await expect(page.locator('.visitor-event-list code').filter({hasText:'127.0.0.1'}).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('textbox',{name:'IP / 注册 ID / 邮箱 / 称呼'}).fill('browser-admin@example.com');
  await page.getByRole('button',{name:'搜索',exact:true}).click();
  await expect(page.locator('.visitor-ip-list article')).toHaveCount(1);
  await page.screenshot({path:'artifacts/themes/visitor-admin-desktop.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:375,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("后台保存品牌默认主题、访客覆盖与恢复默认、旧配置兼容", async ({page, browser}) => {
  const origin = "http://127.0.0.1:4174";
  await page.goto("/login?next=/admin");
  await page.getByRole("textbox", {name: "邮箱地址"}).fill("browser-admin@example.com");
  await page.locator("input[name=password]").fill("BrowserAdmin123!");
  await page.getByRole("button", {name: "登录壹梵"}).click();
  await page.getByRole("button", {name: "品牌与支付"}).click();
  const appearance = page.locator(".appearance-form");
  await appearance.getByRole("button", {name: "翡翠雅绿", exact: true}).click();
  await appearance.getByRole("button", {name: "保存品牌主题", exact: true}).click();
  await expect(page.getByText("品牌主题已更新", {exact: true})).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "sage");
  const visitorContext = await browser.newContext({locale: "zh-CN"});
  const visitor = await visitorContext.newPage();
  try {
    await visitor.goto(origin + "/services");
    await expect(visitor.locator("html")).toHaveAttribute("data-theme", "sage");
    await visitor.getByRole("button", {name: "切换主题", exact: true}).click();
    await visitor.getByRole("dialog").getByRole("button", {name: "午夜鎏金", exact: true}).click();
    await visitor.getByRole("dialog").getByRole("button", {name: "完成", exact: true}).click();
    await appearance.getByRole("button", {name: "玫瑰雾粉", exact: true}).click();
    await appearance.getByRole("button", {name: "保存品牌主题", exact: true}).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "rose");
    await visitor.reload();
    await expect(visitor.locator("html")).toHaveAttribute("data-theme", "noir");
    await visitor.getByRole("button", {name: "切换主题", exact: true}).click();
    await visitor.getByRole("button", {name: /跟随品牌默认/}).click();
    await expect(visitor.locator("html")).toHaveAttribute("data-theme", "rose");
    expect((await visitorContext.cookies()).find(cookie => cookie.name === "YF_THEME")).toBeUndefined();
    await visitor.keyboard.press("Escape");
    await visitor.reload();
    await expect(visitor.locator("html")).toHaveAttribute("data-theme", "rose");
    await page.getByRole("button", {name: "切换主题", exact: true}).click();
    await page.getByRole("dialog").getByRole("button", {name: "午夜鎏金", exact: true}).click();
    await page.keyboard.press("Escape");
    await expect(page.locator('.settings-form input[name="phone"]')).toHaveCSS("background-color", "rgb(32, 36, 38)");
    await page.screenshot({path: "artifacts/themes/noir-admin-desktop.png", fullPage: true, animations: "disabled"});
  } finally {
    await appearance.getByRole("button", {name: "象牙香槟", exact: true}).click();
    await appearance.getByRole("button", {name: "保存品牌主题", exact: true}).click();
    await visitorContext.close();
  }
});

test('社区图床预览与发布、注册 ID 及管理员来源追溯、全主题后台图片替换',async({page,browser})=>{
  test.setTimeout(120000);
  const origin='http://127.0.0.1:4174';
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const image=readFileSync('public/images/wedding.jpg');
  const mockImages=async(context:BrowserContext)=>{
    await context.route('https://cdn.example.com/**',route=>route.request().url().includes('/missing.jpg')
      ? route.abort() : route.fulfill({contentType:'image/jpeg',body:image}));
  };
  await mockImages(page.context());
  const customer=await page.request.post('/api/auth/register',{headers:{origin},data:{
    name:'图床发布顾客',email:'media-'+Date.now()+'@example.com',password:'MediaCustomer123!',consent:true,
  }}).then(r=>r.json());
  await page.goto('/community');
  await page.getByRole('button',{name:'写下我的故事',exact:true}).click();
  const compose=page.getByRole('dialog');
  await compose.getByLabel('给故事一个标题',{exact:true}).fill('图床与发布来源浏览器验证');
  await compose.getByLabel('分享内容',{exact:true}).fill('我的拍摄记录\n![婚纱照片](https://cdn.example.com/markdown.jpg)\n[img]https://cdn.example.com/bbcode.webp[/img]\nhttps://cdn.example.com/direct.png\n<script>window.postXSS=true</script>');
  await compose.getByLabel('图片链接（每行一张，最多 9 张）',{exact:true}).fill('https://cdn.example.com/attachment?id=123\nhttps://cdn.example.com/missing.jpg');
  await compose.locator('.post-preview').scrollIntoViewIfNeeded();
  await compose.locator('.post-preview').evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect(compose.getByRole('link',{name:'图片未能加载，打开原图'})).toBeVisible();
  await expect(compose.locator('.post-preview img')).toHaveCount(4);
  await compose.getByRole('button',{name:'发布我的故事',exact:true}).click();
  await expect(page).toHaveURL(/\/community\/[a-f0-9-]{36}$/);
  const postURL=page.url();
  const postId=postURL.split('/').at(-1)!;
  await expect(page.locator('.post-author-id')).toContainText(customer.user.id);
  await expect(page.locator('.post-content')).toContainText('<script>window.postXSS=true</script>');
  await page.locator('.post-image-grid').scrollIntoViewIfNeeded();
  await expect(page.getByRole('link',{name:'图片未能加载，打开原图'})).toBeVisible();
  await expect(page.locator('.post-content img')).toHaveCount(4);
  for(const img of await page.locator('.post-content img').all()){
    await img.scrollIntoViewIfNeeded();
    await expect.poll(()=>img.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(img).toHaveAttribute('referrerpolicy','no-referrer');
  }
  await expect(page.getByRole('link',{name:'图片未能加载，打开原图'})).toBeVisible();
  expect(await page.evaluate(()=>('postXSS' in window))).toBe(false);
  await expect(page.locator('.post-trace')).toHaveCount(0);
  expect((await page.request.get('/api/admin/post-sources?postId='+postId)).status()).toBe(403);
  const publicPost=await page.request.get('/api/posts/'+postId).then(r=>r.json());
  expect(publicPost).not.toHaveProperty('fingerprint');
  expect(publicPost).not.toHaveProperty('ip');
  await page.setViewportSize({width:375,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/community-images-mobile.png',fullPage:true,animations:'disabled'});
  await page.goto('/community');
  await expect(page.locator('.forum-post').filter({hasText:'图床与发布来源浏览器验证'}).locator('.post-thumbnails img')).toHaveCount(3);

  const adminContext=await browser.newContext({locale:'zh-CN',baseURL:origin,viewport:{width:1440,height:1000}});
  await mockImages(adminContext);
  const admin=await adminContext.newPage();
  admin.on('pageerror',error=>errors.push(error.message));
  try {
    const auth=await adminContext.request.post('/api/auth/login',{headers:{origin},data:{email:'browser-admin@example.com',password:'BrowserAdmin123!'}}).then(r=>r.json());
    await admin.goto(postURL);
    await admin.locator('.post-trace summary').click();
    await expect(admin.locator('.post-source')).toContainText(customer.user.id);
    await expect(admin.locator('.post-source')).toContainText('127.0.0.1');
    await expect(admin.locator('.post-source')).toContainText('browser-reported');
    await expect(admin.locator('.post-source')).toContainText('内网 / 本机');
    const source=await adminContext.request.get('/api/admin/post-sources?postId='+postId).then(r=>r.json());
    expect(source.items[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(source.items[0].browser_signals.language).toBe('zh-CN');
    await admin.goto('/admin');
    await admin.getByRole('button',{name:'社区管理',exact:true}).click();
    await admin.locator('.post-trace').first().locator('summary').click();
    await admin.getByLabel('帖子 ID / 注册 ID / IP / 指纹',{exact:true}).fill(source.items[0].fingerprint);
    await admin.locator('.post-source-panel').first().getByRole('button',{name:'搜索',exact:true}).click();
    await expect(admin.locator('.post-source').first()).toContainText(postId);
    await admin.getByRole('button',{name:'站点图片',exact:true}).click();
    const slots=[['场景影像','hero'],['婚纱影像','wedding'],['品牌故事','story'],['个人写真','portrait'],['庆典布置','celebration'],['礼服','dress'],['化妆造型','beauty'],['角色写真','cosplay']];
    for(const [label,slot]of slots) await admin.getByRole('textbox',{name:label,exact:true}).fill('https://cdn.example.com/site-'+slot+'.jpg');
    await admin.getByRole('button',{name:'保存站点图片',exact:true}).click();
    await expect(admin.getByRole('status')).toHaveText('站点图片已更新');
    await admin.screenshot({path:'artifacts/site-images-admin.png',fullPage:true,animations:'disabled'});
    for(const theme of ['ivory','rose','sage','noir']){
      await page.context().addCookies([{name:'YF_THEME',value:theme,url:origin}]);
      await page.goto('/');
      await expect(page.locator('.hero-image')).toHaveAttribute('src',/https:\/\/cdn\.example\.com\/site-.*\.jpg/);
      await expect.poll(()=>page.locator('.hero-image').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.goto('/services');
      await expect(page.locator('main img[src^="https://cdn.example.com/site-"]').first()).toBeVisible();
    }
    await page.goto('/ar/community/'+postId);
    await expect(page.locator('html')).toHaveAttribute('dir','rtl');
    await expect(page.locator('.post-author-id')).toContainText(customer.user.id);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'artifacts/community-images-ar-mobile.png',fullPage:true,animations:'disabled'});
    const staticContext=await browser.newContext({javaScriptEnabled:false,baseURL:origin});
    await mockImages(staticContext);
    try {
      const staticPage=await staticContext.newPage();
      await staticPage.goto('/portfolio');
      await expect(staticPage.locator('main img[src="https://cdn.example.com/site-wedding.jpg"]').first()).toBeVisible();
    } finally {await staticContext.close();}
    const reset=await adminContext.request.put('/api/admin/settings/media',{headers:{origin,'x-csrf-token':auth.csrf},data:{images:{}}});
    expect(reset.status()).toBe(200);
    await page.goto('/');
    await expect(page.locator('.hero-image')).toHaveAttribute('src',/^\/images\//);
  } finally {await adminContext.close();}
  expect(errors).toEqual([]);
});
