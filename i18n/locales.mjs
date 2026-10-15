// BCP 47 tags. Currency and the booking time zone are independent of language.
export const locales = [
  "zh-CN",
  "zh-TW",
  "en",
  "ja",
  "ko",
  "fr",
  "de",
  "es",
  "pt-BR",
  "ru",
  "ar",
];
export const defaultLocale = "zh-CN";
export const localeNames = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
  ar: "العربية",
};
export const isRtl = (locale) => locale === "ar";
export function matchLocale(value) {
  try {
    const tag = new Intl.Locale(value);
    if (tag.language === "zh")
      return tag.script === "Hant" || ["TW", "HK", "MO"].includes(tag.region)
        ? "zh-TW"
        : "zh-CN";
    return locales.find(
      (locale) => new Intl.Locale(locale).language === tag.language,
    );
  } catch {
    return undefined;
  }
}
export function negotiateLocale(header = "") {
  return (
    header
      .split(",")
      .map((item, index) => {
        const [tag, ...params] = item.trim().split(";");
        const weight = params.find((part) => part.trim().startsWith("q="));
        return { tag, q: weight ? Number(weight.trim().slice(2)) : 1, index };
      })
      .filter(({ q }) => Number.isFinite(q) && q > 0 && q <= 1)
      .sort((a, b) => b.q - a.q || a.index - b.index)
      .map(({ tag }) => matchLocale(tag))
      .find(Boolean) || defaultLocale
  );
}
