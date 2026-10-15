import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const base = (await import("./messages/zh-CN.json")).default;
  const translated = (await import(`./messages/${locale}.json`)).default;
  return {
    locale,
    timeZone: "Asia/Shanghai",
    messages: {
      ...base,
      ...translated,
      copy: { ...base.copy, ...translated.copy },
      common: { ...base.common, ...translated.common },
    },
  };
});
