import {
  computed,
  inject,
  onMounted,
  provide,
  watch,
  type ComputedRef,
  type InjectionKey,
} from "vue";
import { useRouter } from "vue-router";
import catalogue from "../i18n/catalogue.json";
import { defaultLocale, isRtl, locales } from "../i18n/locales.mjs";
import sourceMap from "../i18n/source-map.json";
import { createTranslator } from "../shared/translator.mjs";
import type { Service } from "./lib";
const dictionaries = import.meta.glob("../i18n/messages/*.json", {
  import: "default",
}) as Record<string, () => Promise<Record<string, Record<string, string>>>>;
const loaded = new Map<string, Record<string, Record<string, string>>>();
const translators = new Map<string, ReturnType<typeof createTranslator>>();
export function registerMessages(
  locale: string,
  messages: Record<string, Record<string, string>>,
) {
  if (loaded.get(locale) === messages) return;
  loaded.set(locale, messages);
  // SSR requests and development updates can replace a locale's dictionary.
  // Translators retain the dictionary they were created with.
  for (const id of translators.keys())
    if (id.startsWith(locale + ":")) translators.delete(id);
}
export async function loadLocale(locale: string) {
  if (!loaded.has(locale))
    registerMessages(
      locale,
      await dictionaries["../i18n/messages/" + locale + ".json"](),
    );
}
const key: InjectionKey<ComputedRef<string>> = Symbol("locale");
export function provideI18n() {
  const router = useRouter();
  const locale = computed(() => {
    const first = router.currentRoute.value.path.split("/")[1];
    return locales.includes(first) ? first : defaultLocale;
  });
  provide(key, locale);
  onMounted(() =>
    watch(
      locale,
      (value) => {
        document.documentElement.lang = value;
        document.documentElement.dir = isRtl(value) ? "rtl" : "ltr";
        document.cookie =
          "YF_LOCALE=" +
          value +
          "; Path=/; Max-Age=31536000; SameSite=Lax" +
          (location.protocol === "https:" ? "; Secure" : "");
        const t = translator(value, "copy");
        document.title = String(
          t(sourceMap["壹梵定制 YI FAN · 婚纱与定制影像"]),
        );
        document
          .querySelector('meta[name="description"]')
          ?.setAttribute(
            "content",
            String(
              t(
                sourceMap[
                  "壹梵定制，以婚纱摄影、个人写真、礼服与妆造，记录每一种值得珍藏的你。"
                ],
              ),
            ),
          );
      },
      { immediate: true },
    ),
  );
  return locale;
}
export function useLocale() {
  return inject(key)!;
}
function translator(locale: string, namespace: string) {
  const id = locale + ":" + namespace;
  if (!translators.has(id))
    translators.set(
      id,
      createTranslator({ locale, messages: loaded.get(locale), namespace }),
    );
  return translators.get(id)!;
}
export function useTranslations(namespace: string) {
  const locale = useLocale();
  const translate = (source: string, values?: Record<string, any>): any =>
    translator(locale.value, namespace)(source, values);
  translate.rich = translate;
  return translate;
}
export type CopyValues = Record<string, string | number | Date | undefined>;
export const countMessages = {
  replies: "{count, plural, =0 {暂无回复} one {# 条回复} other {# 条回复}}",
  likes: "{count, plural, one {# 人喜欢} other {# 人喜欢}}",
  views: "{count, plural, one {# 次浏览} other {# 次浏览}}",
  places: "{count, plural, one {余 # 位} other {余 # 位}}",
};
export function useCopy() {
  const t = useTranslations("copy");
  return (source: string, values?: CopyValues): string => {
    const id = (sourceMap as Record<string, string>)[source];
    return id
      ? String(
          t(
            id,
            values
              ? Object.fromEntries(
                  Object.entries(values).map(([name, value]) => [
                    name,
                    value ?? "",
                  ]),
                )
              : undefined,
          ),
        )
      : source;
  };
}
export function useFormatting() {
  const locale = useLocale();
  return {
    money: (cents: number) =>
      new Intl.NumberFormat(locale.value, {
        style: "currency",
        currency: "CNY",
        currencyDisplay: "code",
      }).format(cents / 100),
    dateTime: (timestamp: number) =>
      new Intl.DateTimeFormat(locale.value, {
        timeZone: "Asia/Shanghai",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(timestamp),
    date: (day: string) =>
      new Intl.DateTimeFormat(locale.value, {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(day + "T00:00:00+08:00")),
    time: (timestamp: number) =>
      new Intl.DateTimeFormat(locale.value, {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
      }).format(timestamp),
    number: (value: number) =>
      new Intl.NumberFormat(locale.value).format(value),
    weekday: (day: number) =>
      new Intl.DateTimeFormat(locale.value, {
        timeZone: "UTC",
        weekday: "short",
      }).format(new Date(Date.UTC(2026, 0, 4 + day))),
  };
}
export function localizeService(
  service: Service,
  copy: ReturnType<typeof useCopy>,
): Service {
  const original = (catalogue as Record<string, Partial<Service>>)[service.id];
  if (!original) return service;
  const result = { ...service };
  for (const field of ["title", "description", "duration", "english"] as const)
    if (service[field] === original[field])
      result[field] = copy(service[field]);
  result.features = service.features.map((feature, index) =>
    feature === original.features?.[index] ? copy(feature) : feature,
  );
  return result;
}
export function useServiceTitle() {
  const copy = useCopy();
  return (id: string, title: string) => {
    const original = (catalogue as Record<string, Partial<Service>>)[id];
    return original?.title === title ? copy(title) : title;
  };
}
