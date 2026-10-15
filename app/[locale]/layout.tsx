import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";
import { isRtl } from "../../i18n/locales.mjs";
import sourceMap from "../../i18n/source-map.json";
import "../../src/styles.css";
import "../../src/editorial.css";
import "../../src/i18n.css";

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
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider>
          <Suspense
            fallback={
              <div className="loading">{t(sourceMap["正在打开壹梵…"])}</div>
            }
          >
            {children}
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
