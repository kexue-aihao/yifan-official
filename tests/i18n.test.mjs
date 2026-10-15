import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { locales, negotiateLocale, matchLocale } from "../i18n/locales.mjs";
import { createRuntime } from "../server/install.mjs";

const sourceMap = JSON.parse(
  readFileSync(new URL("../i18n/source-map.json", import.meta.url), "utf8"),
);
const readMessages = (locale) =>
  JSON.parse(
    readFileSync(
      new URL(`../i18n/messages/${locale}.json`, import.meta.url),
      "utf8",
    ),
  );
test("11 language catalogues have complete keys, valid ICU and matching placeholders", () => {
  const base = readMessages("zh-CN");
  const expected = Object.keys(base.copy).sort();
  const parameters = (value) =>
    [
      ...new Set(
        [...value.matchAll(/\{(v\d+|count)[,}]/g)].map((match) => match[1]),
      ),
    ].sort();
  for (const locale of locales) {
    const messages = readMessages(locale);
    assert.deepEqual(Object.keys(messages.copy).sort(), expected, locale);
    assert.deepEqual(
      Object.keys(messages.common),
      Object.keys(base.common),
      locale,
    );
    const t = createTranslator({
      locale,
      messages,
      onError(error) {
        throw error;
      },
    });
    for (const [key, value] of Object.entries(messages.copy)) {
      assert.deepEqual(
        parameters(value),
        parameters(base.copy[key]),
        `${locale}/${key}`,
      );
      const values = Object.fromEntries(
        parameters(value).map((name) => [
          name,
          name === "count" ? 2 : "<script>literal</script>",
        ]),
      );
      assert.equal(typeof t(`copy.${key}`, values), "string");
    }
    assert.ok(
      t.rich("common.consent", {
        privacy: (chunks) => chunks,
        terms: (chunks) => chunks,
      }),
    );
  }
});
test("BCP 47 negotiation respects quality, scripts, regional variants and fallback", () => {
  assert.equal(negotiateLocale("xx;q=1,fr-CA;q=.8,en-US;q=.6"), "fr");
  assert.equal(negotiateLocale("de;q=0,ja-JP;q=.9"), "ja");
  assert.equal(negotiateLocale("en;q=0,xx;q=0.8"), "zh-CN");
  assert.equal(negotiateLocale("pt-PT,ru;q=.5"), "pt-BR");
  assert.equal(matchLocale("zh-Hant-HK"), "zh-TW");
  assert.equal(matchLocale("zh-SG"), "zh-CN");
  assert.equal(matchLocale("ar-SA"), "ar");
  assert.equal(negotiateLocale("garbage_!;q=bad"), "zh-CN");
});
test("Russian and Arabic use their own plural rules", () => {
  const key = sourceMap["{count, plural, one {# 人喜欢} other {# 人喜欢}}"];
  const ru = createTranslator({
    locale: "ru",
    messages: readMessages("ru"),
    namespace: "copy",
  });
  const ar = createTranslator({
    locale: "ar",
    messages: readMessages("ar"),
    namespace: "copy",
  });
  assert.notEqual(ru(key, { count: 1 }), ru(key, { count: 2 }));
  assert.match(ru(key, { count: 5 }), /отметок/);
  assert.equal(ar(key, { count: 0 }), "لا إعجابات");
  assert.equal(ar(key, { count: 2 }), "إعجابان");
});
test("installer API negotiates error language and validation without modifying protocol or site state", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "yifan-i18n-"));
  const runtime = await createRuntime({
    dataDir: directory,
    origin: "http://locale.yifan.test",
    testing: true,
  });
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}/api/install/session`;
  for (const locale of ["zh-CN", "en", "fr", "ar"]) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        origin: "http://locale.yifan.test",
        "Content-Type": "application/json",
        "Accept-Language": locale,
      },
      body: JSON.stringify({ key: "incorrect-key" }),
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Content-Language"), locale);
    const data = await response.json();
    assert.equal(
      data.code,
      sourceMap["安装密钥不正确，请查看服务器 data/install.key 文件。"],
    );
    if (["en", "fr", "ar"].includes(locale))
      assert.doesNotMatch(data.error, /\p{Script=Han}/u);
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      origin: "http://locale.yifan.test",
      "Content-Type": "application/json",
      "Accept-Language": "en",
    },
    body: "{}",
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.deepEqual(body.issues[0].path, ["key"]);
  assert.equal(runtime.installed(), false);
});
