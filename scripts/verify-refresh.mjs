// Verify the first frame and repeated reloads against a running dev or built site.
// Run: npm run test:refresh -- http://localhost:5173
import { chromium, webkit, devices, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const origin = process.argv[2] || "http://localhost:5173";
const targets = [
  {
    name: "desktop-chrome",
    browser: chromium,
    channel: "chrome",
    device: { viewport: { width: 1440, height: 1000 } },
  },
  { name: "iphone-safari", browser: webkit, device: devices["iPhone 13"] },
  {
    name: "android-chrome",
    browser: chromium,
    channel: "chrome",
    device: devices["Pixel 7"],
  },
];
mkdirSync("artifacts/refresh", { recursive: true });
const results = [];
for (const target of targets) {
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
      let release;
      const scriptsReady = new Promise((resolve) => {
        release = resolve;
      });
      let scriptsReleased = false;
      try {
        await context.addCookies([
          { name: "YF_THEME", value: theme, url: origin },
        ]);
        await context.route("**/api/visits", (route) =>
          route.fulfill({ status: 202, json: { ok: true } }),
        );
        await context.route("**/*", async (route) => {
          if (route.request().resourceType() === "script") await scriptsReady;
          await route.fallback();
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", () => errors.push("pageerror"));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push("consoleerror");
        });
        // Holding JavaScript reproduces the old unstyled first frame on refresh.
        await page.goto(origin + "/community", { waitUntil: "commit" });
        await expect(page.locator(".community-intro h1")).toBeVisible();
        await expect(page.locator("body")).toHaveCSS("margin", "0px");
        await expect(page.locator(".filter-tabs")).toHaveCSS("display", "flex");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(() =>
            [...document.querySelectorAll('link[rel="stylesheet"]')].every(
              (link) => link.sheet !== null,
            ),
          ),
        ).toBe(true);
        await expect(
          page.getByRole("button", { name: "写下我的故事" }),
        ).toBeDisabled();
        release();
        scriptsReleased = true;
        await expect(
          page.getByRole("button", { name: "写下我的故事" }),
        ).toBeEnabled();
        for (let attempt = 0; attempt < 3; attempt++) {
          await page.reload({ waitUntil: "domcontentloaded" });
          await expect(page.locator("body")).toHaveCSS("margin", "0px");
          await expect(page.locator(".filter-tabs")).toHaveCSS(
            "display",
            "flex",
          );
          await expect(
            page.getByRole("button", { name: "写下我的故事" }),
          ).toBeEnabled();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
        await page.screenshot({
          path: `artifacts/refresh/${target.name}-${theme}-after-reload.png`,
        });
        expect(
          errors.length,
          "Refresh should not produce script or hydration errors",
        ).toBe(0);
        results.push({
          browser: target.name,
          theme,
          styledBeforeJavaScript: true,
          reloads: 3,
          passed: true,
        });
        console.log("PASS", target.name, theme);
      } finally {
        if (!scriptsReleased) release();
        await context.close();
      }
    }
  } finally {
    await browser.close();
    writeFileSync(
      "artifacts/refresh/results.json",
      JSON.stringify(results, null, 2),
    );
  }
}
