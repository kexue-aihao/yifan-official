"use client";
import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import sourceMap from "../i18n/source-map.json";
import catalogue from "../i18n/catalogue.json";
import type { Service } from "./lib";

export type CopyValues = Record<string, string | number | Date | undefined>;
export const countMessages = {
  replies: "{count, plural, =0 {暂无回复} one {# 条回复} other {# 条回复}}",
  likes: "{count, plural, one {# 人喜欢} other {# 人喜欢}}",
  places: "{count, plural, one {余 # 位} other {余 # 位}}",
};
// The source index lets legacy category identifiers stay stable in the database.
// Only explicitly marked interface or default-catalogue fields pass through here.
export function useCopy() {
  const translate = useTranslations("copy");
  return useCallback(
    (source: string, values?: CopyValues) => {
      const key = (sourceMap as Record<string, string>)[source];
      const safeValues = values
        ? Object.fromEntries(
            Object.entries(values).map(([name, value]) => [name, value ?? ""]),
          )
        : undefined;
      return key ? translate(key, safeValues) : source;
    },
    [translate],
  );
}
export function useFormatting() {
  const locale = useLocale();
  return useMemo(
    () => ({
      money: (cents: number) =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "CNY",
          currencyDisplay: "code",
        }).format(cents / 100),
      dateTime: (timestamp: number) =>
        new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Shanghai",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(timestamp),
      date: (day: string) =>
        new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(new Date(`${day}T00:00:00+08:00`)),
      time: (timestamp: number) =>
        new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Shanghai",
          hour: "2-digit",
          minute: "2-digit",
        }).format(timestamp),
      number: (value: number) => new Intl.NumberFormat(locale).format(value),
      weekday: (day: number) =>
        new Intl.DateTimeFormat(locale, {
          timeZone: "UTC",
          weekday: "short",
        }).format(new Date(Date.UTC(2026, 0, 4 + day))),
    }),
    [locale],
  );
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
