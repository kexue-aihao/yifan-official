import { readFileSync } from "node:fs";
import { createTranslator } from "next-intl";
import { locales, defaultLocale, negotiateLocale } from "../i18n/locales.mjs";

const sourceMap = JSON.parse(
  readFileSync(new URL("../i18n/source-map.json", import.meta.url), "utf8"),
);
const translators = Object.fromEntries(
  locales.map((locale) => [
    locale,
    createTranslator({
      locale,
      messages: JSON.parse(
        readFileSync(
          new URL(`../i18n/messages/${locale}.json`, import.meta.url),
          "utf8",
        ),
      ),
      namespace: "copy",
    }),
  ]),
);
export function translateError(source, locale = defaultLocale) {
  const key = sourceMap[source];
  return key ? translators[locale](key) : source;
}
// Install and business APIs share the same explicit request locale. Responses
// remain ordinary JSON; payment provider callbacks keep their original protocol.
export function apiLocale(req, res, next) {
  if (!req.path.startsWith("/api/") || req.yifanLocale) return next();
  const cookie = /(?:^|;\s*)YF_LOCALE=([^;]*)/.exec(
    req.headers.cookie || "",
  )?.[1];
  req.yifanLocale = req.get("Accept-Language")
    ? negotiateLocale(req.get("Accept-Language"))
    : locales.includes(cookie)
      ? cookie
      : defaultLocale;
  res.set("Content-Language", req.yifanLocale);
  res.vary("Accept-Language");
  res.vary("Cookie");
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body.error === "string" && sourceMap[body.error])
      return json({
        ...body,
        code: body.code || sourceMap[body.error],
        error: translateError(body.error, req.yifanLocale),
      });
    return json(body);
  };
  next();
}
export function validationError(error, locale = defaultLocale) {
  const fallback = translateError("请求参数无效，请检查输入后重试。", locale);
  return {
    error:
      locale === "zh-CN"
        ? error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("；")
        : fallback,
    code: "VALIDATION_ERROR",
    issues: error.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
      message: sourceMap[issue.message]
        ? translateError(issue.message, locale)
        : fallback,
    })),
  };
}
