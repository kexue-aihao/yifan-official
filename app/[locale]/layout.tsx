import type { Metadata, Viewport } from "next";
import {cache, Suspense} from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";
import { isRtl } from "../../i18n/locales.mjs";
import sourceMap from "../../i18n/source-map.json";
import {cookies} from "next/headers";
import ThemeProvider from "../../src/ThemeProvider";
import {isTheme, themes, themeCookie, type ThemeId} from "../../src/themes";
import {getDefaultTheme,getSiteImages} from "../../server/appearance.mjs";
import MediaProvider from '../../src/MediaProvider';
import type {CSSProperties} from 'react';
import "../../src/styles.css";
import "../../src/editorial.css";
import "../../src/i18n.css";
import "../../src/themes.css";
import "../../src/layouts.css";
import "../../src/community-media.css";

const appearance = cache(async () => {
  const saved = (await cookies()).get(themeCookie)?.value;
  const preference = isTheme(saved) ? saved : null;
  const siteTheme = await getDefaultTheme() as ThemeId;
  return {preference, siteTheme, theme: preference || siteTheme};
});
export async function generateViewport(): Promise<Viewport> {
  const {theme} = await appearance();
  return {themeColor: themes.find(item => item.id === theme)!.color, colorScheme: theme === "noir" ? "dark" : "light"};
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "copy" });
  return {
    title: t(sourceMap["壹梵定制 YI FAN · 婚纱与定制影像"]),
    description: t(
      sourceMap[
        "壹梵定制，以婚纱摄影、个人写真、礼服与妆造，记录每一种值得珍藏的你。"
      ],
    ),
  };
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("copy");
  const {preference, siteTheme, theme} = await appearance();
  const images = await getSiteImages();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} data-theme={theme} data-scroll-behavior="smooth">
      <body style={{'--image-dress': `url("${images.dress || '/images/dress.jpg'}")`} as CSSProperties}>
        <NextIntlClientProvider>
          <ThemeProvider initialTheme={siteTheme} preference={preference}>
            <MediaProvider initialImages={images}>
            <Suspense
              fallback={
                <div className="loading">{t(sourceMap["正在打开壹梵…"])}</div>
              }
            >
              {children}
            </Suspense>
            </MediaProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
