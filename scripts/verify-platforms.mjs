// Read-only smoke checks against an already installed preview.
// Run: node scripts/verify-platforms.mjs [http://localhost:5173]
import { chromium, webkit, firefox, devices, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const origin = process.argv[2] || "http://localhost:5173";
const matrix = [
  { name: "iphone-webkit", browser: webkit, device: devices["iPhone 13"] },
  { name: "ipad-webkit", browser: webkit, device: devices["iPad (gen 7)"] },
  {
    name: "android-chrome",
    browser: chromium,
    channel: "chrome",
    device: devices["Pixel 7"],
  },
  {
    name: "desktop-chrome",
    browser: chromium,
    channel: "chrome",
    device: { viewport: { width: 1440, height: 1000 } },
  },
  {
    name: "desktop-firefox",
    browser: firefox,
    device: { viewport: { width: 1440, height: 1000 } },
  },
];
mkdirSync("artifacts/vue-platforms", { recursive: true });
const results = [];
for (const target of matrix) {
  const browser = await target.browser.launch({
    headless: true,
    ...(target.channel ? { channel: target.channel } : {}),
  });
  try {
    for (const theme of ["ivory", "rose", "sage", "noir"]) {
      const context = await browser.newContext({
        ...target.device,
        locale: "zh-CN",
      });
      // Visual checks do not add synthetic page-view records to the preview.
      await context.route("**/api/visits", (route) =>
        route.fulfill({ status: 202, json: { ok: true } }),
      );
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" || /hydration/i.test(message.text()))
          errors.push(message.text());
      });
      await context.addCookies([
        { name: "YF_THEME", value: theme, url: origin },
      ]);
      await page.goto(origin + "/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".site-error")).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBe(true);
      if (theme === "ivory") {
        await page.getByRole("button", { name: "下一张影像" }).click();
        await expect(
          page.getByRole("heading", { name: "让心动，有迹可循。" }),
        ).toBeVisible();
      }
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      if (theme === "ivory") {
        await expect(page.locator(".cinema-actions")).toHaveCSS("opacity", "1");
        await expect
          .poll(() =>
            page
              .locator(".cinema-line > span")
              .first()
              .evaluate((element) => {
                const transform = getComputedStyle(element).transform;
                return (
                  transform === "none" ||
                  Math.abs(new DOMMatrix(transform).m42) < 0.1
                );
              }),
          )
          .toBe(true);
        const next = await page.locator(".scene-next").boundingBox();
        const chat = await page.locator(".chat-launcher").boundingBox();
        expect(
          next.x + next.width <= chat.x ||
            next.x >= chat.x + chat.width ||
            next.y + next.height <= chat.y ||
            next.y >= chat.y + chat.height,
          "Hero controls remain clear of the floating chat button",
        ).toBe(true);
      }
      await page.screenshot({
        path: `artifacts/vue-platforms/${target.name}-${theme}.png`,
      });
      await page.evaluate(() =>
        document.querySelector('.nav a[href="/portfolio"]').click(),
      );
      await expect(page).toHaveURL(/\/portfolio$/);
      await expect(page.locator(".route-transition")).toHaveAttribute(
        "data-phase",
        "idle",
      );
      await page.getByRole("button", { name: "个人写真", exact: true }).click();
      await expect(page.locator(".gallery-item")).toHaveCount(1);
      await page.locator(".gallery-item").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "关闭弹窗" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator(".gallery-item")).toBeFocused();
      await page.evaluate(() =>
        document.querySelector('.nav a[href="/services"]').click(),
      );
      await expect(
        page.locator('[data-layout^="services-"] article, .package-card'),
      ).toHaveCount(6);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBe(true);
      expect(errors, `${target.name}/${theme}`).toEqual([]);
      results.push({ browser: target.name, theme, passed: true });
      await context.close();
      console.log("PASS", target.name, theme);
    }
    const context = await browser.newContext({
      ...target.device,
      locale: "ar",
      reducedMotion: "reduce",
    });
    await context.route("**/api/visits", (route) =>
      route.fulfill({ status: 202, json: { ok: true } }),
    );
    const page = await context.newPage();
    await page.goto(origin + "/ar/services");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".package-card")).toHaveCount(6);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await page.evaluate(() =>
      document.querySelector('.nav a[href="/ar/portfolio"]').click(),
    );
    await expect(page).toHaveURL(/\/ar\/portfolio$/);
    await expect(page.locator(".route-transition")).toHaveAttribute(
      "data-phase",
      "idle",
    );
    results.push({
      browser: target.name,
      theme: "RTL/reduced-motion",
      passed: true,
    });
    await context.close();
  } finally {
    await browser.close();
    writeFileSync(
      "artifacts/vue-platforms/results.json",
      JSON.stringify(results, null, 2),
    );
  }
}
console.log(
  `${results.length} platform scenarios passed. Browser/device emulation; physical devices not exercised.`,
);
