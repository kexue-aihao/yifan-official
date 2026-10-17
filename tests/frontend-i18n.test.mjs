import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

test("SSR uses the replacement dictionary on successive requests for the same language", async (t) => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
  });
  t.after(() => vite.close());
  const { render } = await vite.ssrLoadModule("/src/entry-server.ts");
  const messages = JSON.parse(
    await readFile(
      new URL("../i18n/messages/zh-CN.json", import.meta.url),
      "utf8",
    ),
  );
  const sourceMap = JSON.parse(
    await readFile(new URL("../i18n/source-map.json", import.meta.url), "utf8"),
  );
  const titleKey = sourceMap["分享美好，让灵感相遇。"];
  const initial = {
    locale: "zh-CN",
    siteTheme: "ivory",
    preference: null,
    images: {},
    messages,
  };
  // The first request holds an older dictionary; the next carries new copy.
  const before = structuredClone(initial);
  before.messages.copy[titleKey] = "更新之前的社区文案";
  assert.ok(
    (await render("/community", before)).html.includes("更新之前的社区文案"),
  );
  const after = structuredClone(initial);
  after.messages.copy[titleKey] = "更新之后的社区文案";
  const updated = (await render("/community", after)).html;
  assert.ok(updated.includes("更新之后的社区文案"));
  assert.ok(!updated.includes("更新之前的社区文案"));
  // Updating another language must not restore the old Chinese dictionary.
  const english = (await render("/en/community", { ...initial, locale: "en" }))
    .html;
  // A select's value attribute does not select an option in server HTML.
  assert.match(english, /<option\b[^>]*value="en"[^>]*selected/);
  assert.equal(
    (english.match(/<option\b[^>]*selected[^>]*>/g) || []).length,
    1,
  );
  const current = (await render("/community", initial)).html;
  assert.ok(current.includes("分享美好，让灵感相遇。"));
  assert.ok(!current.includes("更新之后的社区文案"));
});
