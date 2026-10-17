import express from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  locales,
  defaultLocale,
  negotiateLocale,
  isRtl,
} from "../i18n/locales.mjs";
import { createTranslator } from "../shared/translator.mjs";
import { getDefaultTheme, getSiteImages, themeIds } from "./appearance.mjs";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const colors = {
  ivory: "#f8f6f0",
  rose: "#fcf6f6",
  sage: "#f3f6f1",
  noir: "#171a1b",
};
const sourceMap = JSON.parse(
  await readFile(new URL("../i18n/source-map.json", import.meta.url), "utf8"),
);
const messages = Object.fromEntries(
  await Promise.all(
    locales.map(async (locale) => [
      locale,
      JSON.parse(
        await readFile(
          new URL(`../i18n/messages/${locale}.json`, import.meta.url),
          "utf8",
        ),
      ),
    ]),
  ),
);

export async function attachFrontend(app, { dev = false } = {}) {
  let vite, template, render;
  if (dev) {
    const { createServer } = await import("vite");
    vite = await createServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    template = await readFile(resolve("dist/client/index.html"), "utf8");
    render = (
      await import(pathToFileURL(resolve("dist/server/entry-server.js")).href)
    ).render;
    app.use(
      "/assets",
      express.static(resolve("dist/client/assets"), {
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.use(
      express.static(resolve("dist/client"), { index: false, maxAge: 3600000 }),
    );
  }
  app.use(async (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      req.path.startsWith("/api/") ||
      /\.[a-z0-9]+$/i.test(req.path)
    )
      return next();
    try {
      const first = req.path.split("/")[1];
      const explicit = locales.includes(first);
      const cookie = /(?:^|;\s*)YF_LOCALE=([^;]*)/.exec(
        req.headers.cookie || "",
      )?.[1];
      const locale = explicit
        ? first
        : locales.includes(cookie)
          ? cookie
          : negotiateLocale(req.get("Accept-Language") || "");
      if (!explicit && locale !== defaultLocale)
        return res.redirect(
          307,
          `/${locale}${req.originalUrl === "/" ? "" : req.originalUrl}`,
        );
      if (first === defaultLocale)
        return res.redirect(
          308,
          req.originalUrl.slice(defaultLocale.length + 1) || "/",
        );
      const saved = /(?:^|;\s*)YF_THEME=([^;]*)/.exec(
        req.headers.cookie || "",
      )?.[1];
      const [siteTheme, images] = await Promise.all([
        getDefaultTheme(),
        getSiteImages(),
      ]);
      const preference = themeIds.includes(saved) ? saved : null;
      const theme = preference || siteTheme,
        scheme = theme === "noir" ? "dark" : "light";
      // Vite reloads modules when dictionaries change, but this Express module
      // stays alive. Match the current client dictionary in every dev response.
      const localeMessages = dev
        ? JSON.parse(
            await readFile(
              new URL(`../i18n/messages/${locale}.json`, import.meta.url),
              "utf8",
            ),
          )
        : messages[locale];
      const initial = {
        locale,
        siteTheme,
        preference,
        images,
        messages: localeMessages,
      };
      const t = createTranslator({
        locale,
        messages: localeMessages,
        namespace: "copy",
      });
      const currentTemplate = dev
        ? await vite.transformIndexHtml(
            req.originalUrl,
            await readFile(resolve("index.html"), "utf8"),
          )
        : template;
      const renderer = dev
        ? (await vite.ssrLoadModule("/src/entry-server.ts")).render
        : render;
      const result = await renderer(req.originalUrl, initial);
      const values = {
        locale,
        direction: isRtl(locale) ? "rtl" : "ltr",
        theme,
        scheme,
        "theme-color": colors[theme],
        title: escape(t(sourceMap["壹梵定制 YI FAN · 婚纱与定制影像"])),
        description: escape(
          t(
            sourceMap[
              "壹梵定制，以婚纱摄影、个人写真、礼服与妆造，记录每一种值得珍藏的你。"
            ],
          ),
        ),
        dress: escape(`url("${images.dress || "/images/dress.jpg"}")`),
        "app-html": result.html,
        state:
          "window.__YIFAN__=" +
          JSON.stringify(initial)
            .replace(/</g, "\\u003c")
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029"),
      };
      let html = currentTemplate.replace(
        /<!--([a-z-]+)-->/g,
        (match, key) => values[key] ?? match,
      );
      if (result.status === 404)
        html = html.replace(
          "</head>",
          '<meta name="robots" content="noindex" /></head>',
        );
      res
        .status(result.status)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          "Content-Language": locale,
          "Cache-Control": "private, no-store",
          Vary: "Accept-Language, Cookie",
          "Content-Security-Policy":
            "img-src 'self' data: https:; object-src 'none'; base-uri 'self'",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        })
        .send(html);
    } catch (error) {
      vite?.ssrFixStacktrace(error);
      next(error);
    }
  });
  return { close: () => vite?.close() };
}
