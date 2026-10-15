import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./locales.mjs";
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeCookie: { name: "YF_LOCALE", sameSite: "lax", maxAge: 31536000 },
});
