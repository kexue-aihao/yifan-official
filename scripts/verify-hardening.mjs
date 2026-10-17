// Read-only browser checks. Chat traffic is mocked; preview business data is untouched.
import { chromium, firefox, webkit, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const origin = process.argv[2] || "http://localhost:5173";
const output = "artifacts/ui-hardening";
mkdirSync(output, { recursive: true });
const results = [];
const targets = [
  { name: "chrome", engine: chromium, options: { channel: "chrome" } },
  { name: "webkit", engine: webkit },
  { name: "firefox", engine: firefox },
];
async function check(name, task) {
  if (process.argv[3] && !name.includes(process.argv[3])) return;
  try {
    await task();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    throw error;
  } finally {
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  }
}
async function contextFor(browser, options = {}) {
  const context = await browser.newContext({ locale: "zh-CN", ...options });
  await context.route("**/api/visits", (route) =>
    route.fulfill({ status: 202, json: { ok: true } }),
  );
  return context;
}
const fitsViewport = (page) =>
  expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
const readableFields = (page) =>
  expect
    .poll(() =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "input:not([type=checkbox]):not([type=radio]),select,textarea",
          ),
        ]
          .filter((element) => element.getBoundingClientRect().width)
          .every(
            (element) => parseFloat(getComputedStyle(element).fontSize) >= 16,
          ),
      ),
    )
    .toBe(true);

for (const target of targets) {
  const browser = await target.engine.launch({
    headless: true,
    ...target.options,
  });
  try {
    for (const theme of ["ivory", "rose", "sage", "noir"]) {
      await check(`${target.name}/${theme}/responsive-navigation`, async () => {
        const context = await contextFor(browser, {
          viewport: { width: 320, height: 900 },
          hasTouch: true,
          ...(target.name !== "firefox" ? { isMobile: true } : {}),
        });
        try {
          await context.addCookies([
            { name: "YF_THEME", value: theme, url: origin },
          ]);
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto(`${origin}/de/services`);
          await expect(page.locator(".language-switcher select")).toHaveValue(
            "de",
          );
          await expect(page.locator("#main article").first()).toBeVisible();
          await fitsViewport(page);
          await page.screenshot({
            path: `${output}/${target.name}-${theme}-320.png`,
          });
          await page.goto(`${origin}/de/login`);
          await page.locator("input[name=email]").waitFor();
          await readableFields(page);
          await fitsViewport(page);
          await expect(
            page.locator(".header .account-link"),
          ).toHaveAccessibleName(/\S/);
          await page.setViewportSize({ width: 768, height: 900 });
          await readableFields(page);
          await page.setViewportSize({ width: 844, height: 390 });
          await page.locator(".menu-toggle").click();
          await expect(page.locator(".nav")).toHaveCSS("opacity", "1");
          expect(
            await page
              .locator(".nav")
              .evaluate(
                (element) =>
                  element.getBoundingClientRect().bottom <= innerHeight,
              ),
          ).toBe(true);
          expect(
            await page
              .locator(".nav")
              .evaluate(
                (element) =>
                  getComputedStyle(element).transitionDuration !== "0s",
              ),
          ).toBe(true);
          await page.locator(".nav a").last().scrollIntoViewIfNeeded();
          const last = await page.locator(".nav a").last().boundingBox();
          expect(last.y + last.height).toBeLessThanOrEqual(390);
          await page.screenshot({
            path: `${output}/${target.name}-${theme}-landscape.png`,
          });
          await page.locator('.nav a[href$="/portfolio"]').focus();
          await page.keyboard.press("Enter");
          await page.waitForURL("**/portfolio");
          await expect(page.locator("#main h1")).toBeFocused();
          await expect(page.locator(".route-transition")).toHaveAttribute(
            "data-phase",
            "idle",
          );
          const language = page.locator(".language-switcher select");
          await language.focus();
          await language.selectOption("ar");
          await page.waitForURL("**/ar/portfolio");
          await expect(language).toBeFocused();
          await fitsViewport(page);
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }

    await check(`${target.name}/chat-drafts-history-focus`, async () => {
      const context = await contextFor(browser, {
        viewport: { width: 1440, height: 1000 },
      });
      let releaseSend;
      const sendGate = new Promise((resolve) => {
        releaseSend = resolve;
      });
      let sent = 0,
        failSend = false;
      const start = Date.now() - 120000;
      const message = (index) => ({
        id: `m${index}`,
        sender_id: "staff",
        sender_name: "顾问",
        sender_role: "admin",
        body: `历史消息 ${index} / ${"消息内容。".repeat(12)}`,
        created_at: start + index * 1000,
      });
      const items = Array.from({ length: 100 }, (_, index) =>
        message(index + 5),
      );
      await context.addInitScript(() => {
        window.EventSource = class extends EventTarget {
          constructor() {
            super();
            window.reviewEvents = this;
          }
          close() {}
        };
      });
      await context.route("**/api/auth/me", (route) =>
        route.fulfill({
          json: {
            user: { id: "review-customer", name: "检查用户", role: "customer" },
            csrf: "mock",
          },
        }),
      );
      await context.route("**/api/conversations", (route) =>
        route.fulfill({
          json:
            route.request().method() === "POST"
              ? { id: "review-thread" }
              : [{ id: "review-thread" }],
        }),
      );
      await context.route(
        "**/api/conversations/review-thread/messages*",
        async (route) => {
          if (route.request().method() === "POST") {
            sent++;
            const body = route.request().postDataJSON().body;
            await sendGate;
            if (failSend)
              return route.fulfill({
                status: 503,
                json: { error: "模拟网络失败" },
              });
            items.push({
              ...message(105 + sent),
              id: `sent-${sent}`,
              sender_id: "review-customer",
              body,
              created_at: Date.now(),
            });
            return route.fulfill({ status: 201, json: { ok: true } });
          }
          return route.fulfill({
            json: new URL(route.request().url()).searchParams.has("before")
              ? Array.from({ length: 5 }, (_, index) => message(index))
              : items,
          });
        },
      );
      try {
        const page = await context.newPage(),
          errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(origin);
        const launcher = page.getByRole("button", { name: "打开专属客服" });
        await launcher.click();
        await expect(
          page.getByRole("button", { name: "关闭客服会话" }),
        ).toBeFocused();
        await expect(page.locator(".message")).toHaveCount(100);
        await expect(page.locator(".chat-panel")).toHaveCSS(
          "transform",
          "none",
        );
        const list = page.locator(".message-list");
        await expect
          .poll(() =>
            list.evaluate(
              (element) =>
                element.scrollHeight - element.clientHeight - element.scrollTop,
            ),
          )
          .toBeLessThan(2);
        await list.evaluate((element) => {
          element.scrollTop = 60;
        });
        // Deliver the browser scroll event before the simulated live message.
        await page.evaluate(() => new Promise(requestAnimationFrame));
        items.push({
          ...message(106),
          id: "incoming",
          body: "新消息",
          created_at: Date.now(),
        });
        await page.evaluate(() =>
          window.reviewEvents.dispatchEvent(
            new MessageEvent("update", { data: "{}" }),
          ),
        );
        await expect(page.locator(".message")).toHaveCount(101);
        expect(await list.evaluate((element) => element.scrollTop)).toBeCloseTo(
          60,
          0,
        );
        await list.evaluate((element) => {
          element.scrollTop = 0;
        });
        const anchor = page.getByText(message(5).body, { exact: true });
        const anchorTop =
          (await anchor.boundingBox()).y - (await list.boundingBox()).y;
        await page.getByRole("button", { name: "查看更早消息" }).click();
        await expect(page.locator(".message")).toHaveCount(106);
        expect(
          Math.abs(
            (await anchor.boundingBox()).y -
              (await list.boundingBox()).y -
              anchorTop,
          ),
        ).toBeLessThan(2);
        const draft = page.getByRole("textbox", { name: "消息内容" });
        await draft.fill("第一条发送内容");
        await page.getByRole("button", { name: "发送消息" }).click();
        await expect.poll(() => sent).toBe(1);
        await draft.fill("第二条尚未发送的草稿");
        releaseSend();
        await expect(
          page.getByText("第一条发送内容", { exact: true }),
        ).toBeVisible();
        await expect(draft).toHaveValue("第二条尚未发送的草稿");
        await expect(
          page.getByRole("button", { name: "发送消息" }),
        ).toBeEnabled();
        failSend = true;
        await page.getByRole("button", { name: "发送消息" }).click();
        await expect(page.getByRole("alert")).toContainText("模拟网络失败");
        await expect(draft).toHaveValue("第二条尚未发送的草稿");
        await draft.focus();
        await page.keyboard.press("Escape");
        await expect(page.locator(".chat-panel")).toHaveCount(0);
        await expect(launcher).toBeFocused();
        await page.emulateMedia({ reducedMotion: "reduce" });
        await launcher.click();
        await expect(page.locator(".chat-panel")).toBeVisible();
        expect(
          await page
            .locator(".chat-panel")
            .evaluate((element) => getComputedStyle(element).transform),
        ).toBe("none");
        await page.keyboard.press("Escape");
        await expect(page.locator(".chat-panel")).toHaveCount(0);
        await expect(launcher).toBeFocused();
        expect(errors).toEqual([]);
      } finally {
        releaseSend();
        await context.close();
      }
    });

    await check(`${target.name}/feed-network-recovery`, async () => {
      const context = await contextFor(browser);
      let fail = true;
      await context.route("**/api/posts?*", (route) =>
        route.fulfill(
          fail
            ? { status: 503, json: { error: "模拟网络失败" } }
            : { json: { posts: [], total: 0, pageSize: 12 } },
        ),
      );
      try {
        const page = await context.newPage();
        await page.goto(`${origin}/community`);
        await expect(page.getByRole("alert")).toContainText("模拟网络失败");
        await expect(
          page.getByRole("heading", { name: "第一篇故事，等你来写。" }),
        ).toHaveCount(0);
        fail = false;
        await page.getByRole("button", { name: "重新连接" }).click();
        await expect(
          page.getByRole("heading", { name: "第一篇故事，等你来写。" }),
        ).toBeVisible();
        await expect(page.getByRole("alert")).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close();
  }
}
console.log(
  `${results.length} UI hardening scenarios passed (browser emulation).`,
);
