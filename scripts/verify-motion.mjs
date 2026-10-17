// Exercise real intermediate animation states, interruption and cleanup.
// npm run test:motion -- http://localhost:5173
import { chromium, webkit, devices, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const origin = process.argv[2] || "http://localhost:5173";
const targets = [
  {
    name: "desktop-chrome",
    browser: chromium,
    channel: "chrome",
    device: { viewport: { width: 1440, height: 960 } },
  },
  { name: "iphone-safari", browser: webkit, device: devices["iPhone 13"] },
  {
    name: "android-chrome",
    browser: chromium,
    channel: "chrome",
    device: devices["Pixel 7"],
  },
];
mkdirSync("artifacts/motion", { recursive: true });
const results = [];
const idle = (page) =>
  expect(page.locator(".route-transition")).toHaveAttribute(
    "data-phase",
    "idle",
  );
const clickRoute = (page, path) =>
  page.evaluate(
    (path) => document.querySelector(`.nav a[href="${path}"]`).click(),
    path,
  );

async function freezeRoute(page, navigate) {
  await page.evaluate(() => {
    window.motionSample = null;
    const observer = new MutationObserver(() => {
      if (
        document.querySelector(".route-transition").dataset.phase !== "entering"
      )
        return;
      const incoming = document.querySelector("#main > .route-stage");
      const outgoing = document.querySelector(".route-snapshot > .route-stage");
      for (const element of [incoming, outgoing]) {
        for (const animation of element.getAnimations()) {
          animation.pause();
          animation.currentTime = 100;
        }
      }
      window.motionSample = {
        opacity: Number(getComputedStyle(incoming).opacity),
        transform: incoming.getAnimations()[0].effect.getKeyframes()[0]
          .transform,
        inert: outgoing.inert,
        hidden: outgoing.getAttribute("aria-hidden"),
        ids: outgoing.querySelectorAll("[id]").length,
      };
      observer.disconnect();
    });
    observer.observe(document.querySelector(".route-transition"), {
      attributes: true,
      attributeFilter: ["data-phase"],
    });
  });
  await navigate();
  await expect
    .poll(() => page.evaluate(() => !!window.motionSample))
    .toBe(true);
  return page.evaluate(() => window.motionSample);
}
async function playRoute(page) {
  await page.evaluate(() => {
    for (const element of document.querySelectorAll(
      "#main > .route-stage, .route-snapshot > .route-stage",
    ))
      for (const animation of element.getAnimations()) animation.play();
  });
  await idle(page);
  await expect(page.locator(".route-snapshot > *")).toHaveCount(0);
}

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
      const errors = [];
      try {
        await context.addCookies([
          { name: "YF_THEME", value: theme, url: origin },
        ]);
        await context.route("**/api/visits", (route) =>
          route.fulfill({ status: 202, json: { ok: true } }),
        );
        await context.route("**/api/posts/*/views", (route) =>
          route.fulfill({ json: { counted: false, view_count: 0 } }),
        );
        let releaseCategory;
        await context.route("**/api/posts?*", async (route) => {
          const filtered = new URL(route.request().url()).searchParams.has(
            "category",
          );
          if (filtered)
            await new Promise((resolve) => {
              releaseCategory = resolve;
            });
          await route.fulfill({
            json: {
              posts: [
                {
                  id: filtered ? "motion-filtered" : "motion-all",
                  author: "动效验证",
                  user_id: "motion-fixture",
                  title: filtered ? "筛选后的故事" : "保持阅读中的故事",
                  category: "婚纱灵感",
                  body: "用于验证异步内容交接。",
                  images: [],
                  created_at: Date.now(),
                  view_count: 0,
                  like_count: 0,
                  comment_count: 0,
                },
              ],
              total: 1,
              pageSize: 12,
            },
          });
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(origin + "/portfolio");
        await page.waitForFunction(
          () => !!document.querySelector("#app").__vue_app__,
        );
        await expect(page.locator("#main .gallery-item")).toHaveCount(8);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        // Actual movement and retained outgoing frame, including browser Back.
        const forward = await freezeRoute(page, () =>
          clickRoute(page, "/services"),
        );
        expect(forward.opacity).toBeGreaterThan(0);
        expect(forward.opacity).toBeLessThan(1);
        expect(forward.inert).toBe(true);
        expect(forward.hidden).toBe("true");
        expect(forward.ids).toBe(0);
        await page.screenshot({
          path: `artifacts/motion/${target.name}-${theme}-route.png`,
        });
        await playRoute(page);
        const back = await freezeRoute(page, () => page.goBack());
        expect(back.transform).not.toBe(forward.transform);
        await playRoute(page);

        // The last click wins even while a different route is still entering.
        await freezeRoute(page, () => clickRoute(page, "/services"));
        await clickRoute(page, "/community");
        await expect(page).toHaveURL(/\/community$/);
        await idle(page);
        await expect(page.locator("#main > .route-stage")).toHaveCSS(
          "opacity",
          "1",
        );
        await expect(page.locator("html")).not.toHaveAttribute(
          "data-route-moving",
          "true",
        );

        // A pending response keeps the old story readable instead of collapsing.
        await expect(page.locator("#main .forum-post h2")).toHaveText(
          "保持阅读中的故事",
        );
        const height = await page
          .locator(".feed-results")
          .evaluate((el) => el.getBoundingClientRect().height);
        await page
          .getByRole("button", { name: "婚纱灵感", exact: true })
          .click();
        await expect(page.locator(".feed-results")).toHaveAttribute(
          "aria-busy",
          "true",
        );
        await expect(page.locator("#main .forum-post h2")).toHaveText(
          "保持阅读中的故事",
        );
        expect(
          await page
            .locator(".feed-results")
            .evaluate((el) => el.getBoundingClientRect().height),
        ).toBe(height);
        await expect.poll(() => typeof releaseCategory).toBe("function");
        releaseCategory();
        await expect(page.locator("#main .forum-post h2")).toHaveText(
          "筛选后的故事",
        );
        await expect(page.locator(".feed-results")).toHaveAttribute(
          "aria-busy",
          "false",
        );

        await clickRoute(page, "/portfolio");
        await idle(page);
        await page
          .getByRole("button", { name: "个人写真", exact: true })
          .click();
        await expect(page.locator("#main .gallery-item")).toHaveCount(1);
        const card = page.locator("#main .gallery-item");
        await card.click();
        await expect(page.locator(".image-flight")).toHaveCount(1);
        const flight = await page.locator(".image-flight").evaluate((image) => {
          const animation = image.getAnimations()[0];
          animation.pause();
          animation.currentTime = 160;
          const frames = animation.effect.getKeyframes();
          return {
            start: frames[0].width,
            end: frames.at(-1).width,
            rect: image.getBoundingClientRect().toJSON(),
          };
        });
        expect(flight.start).not.toBe(flight.end);
        expect(flight.rect.width).toBeGreaterThan(0);
        await page.screenshot({
          path: `artifacts/motion/${target.name}-${theme}-image.png`,
        });
        // Closing during entry must reverse from the current photograph.
        await page.getByRole("button", { name: "关闭弹窗" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(card).toBeFocused();
        await expect(card.locator("img")).toHaveCSS("visibility", "visible");
        await expect(page.locator(".image-flight")).toHaveCount(0);
        expect(
          await page.evaluate(() => document.body.style.overflow),
        ).not.toBe("hidden");
        // Completed entry also has a return flight.
        await card.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.locator(".image-flight")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.locator(".image-flight")).toHaveCount(1);
        await expect(page.getByRole("dialog")).toHaveCount(0);

        if (theme === "ivory") {
          await card.click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await freezeRoute(page, () => clickRoute(page, "/services"));
          await expect(page.locator(".route-snapshot dialog")).toHaveCount(0);
          await expect(page.locator(".route-snapshot [name]")).toHaveCount(0);
          await playRoute(page);
          expect(
            await page.evaluate(() => document.body.style.overflow),
          ).not.toBe("hidden");
          await clickRoute(page, "/portfolio");
          await idle(page);
        }

        if (target.device.isMobile) {
          const toggle = page.getByRole("button", { name: "打开导航" });
          await toggle.click();
          await expect(page.locator(".nav")).toBeVisible();
          await page.locator(".nav a").first().focus();
          await page.keyboard.press("Escape");
          await expect(page.locator(".nav")).toBeHidden();
          await expect(toggle).toBeFocused();
          await toggle.click();
          await page.locator(".nav a[href='/services']").click();
          await idle(page);
          await expect(page.locator(".nav")).toBeHidden();
        }

        // A preference change interrupts movement and cleans up every layer.
        await freezeRoute(page, () => clickRoute(page, "/community"));
        await page.emulateMedia({ reducedMotion: "reduce" });
        await idle(page);
        await expect(page.locator(".route-snapshot > *")).toHaveCount(0);
        await clickRoute(page, "/portfolio");
        await idle(page);
        await expect(page.locator("#main > .route-stage")).toHaveCSS(
          "transform",
          "none",
        );
        await page.locator("#main .gallery-item").first().click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.locator(".image-flight")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        if (theme === "ivory") {
          await page.emulateMedia({ reducedMotion: "no-preference" });
          let releaseImage;
          await context.route("**/images/story.jpg", async (route) => {
            await new Promise((resolve) => {
              releaseImage = resolve;
            });
            await route.continue();
          });
          await page.goto(origin + "/");
          await page.waitForFunction(
            () => !!document.querySelector("#app").__vue_app__,
          );
          const title = await page.locator(".cinema h1").innerText();
          await page.locator(".scene-progress button").nth(1).click();
          await expect(page.locator(".cinema")).toHaveAttribute(
            "aria-busy",
            "true",
          );
          expect(await page.locator(".cinema h1").innerText()).toBe(title);
          await expect.poll(() => typeof releaseImage).toBe("function");
          await page.locator(".scene-progress button").nth(2).click();
          await expect(page.locator(".cinema")).toHaveAttribute(
            "aria-busy",
            "false",
          );
          releaseImage();
          await expect(page.locator(".cinema-media img")).toHaveCount(1);
          await expect(page.locator(".cinema-media img")).toHaveAttribute(
            "src",
            /portrait/,
          );
          await expect(page.locator(".cinema h1")).toHaveCount(1);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(errors).toEqual([]);
        results.push({ browser: target.name, theme, status: "passed" });
        console.log(`PASS ${target.name} ${theme}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(
  "artifacts/motion/results.json",
  JSON.stringify({ origin, results }, null, 2),
);
