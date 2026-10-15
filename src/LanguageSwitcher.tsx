"use client";
import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { useRouter, usePathname } from "../i18n/navigation";
import { locales, localeNames } from "../i18n/locales.mjs";
import { useCopy } from "./i18n";

export default function LanguageSwitcher() {
  const locale = useLocale(),
    copy = useCopy();
  const pathname = usePathname(),
    router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="language-switcher">
      <Languages size={17} aria-hidden="true" />
      <select
        aria-label={copy("选择语言")}
        value={locale}
        disabled={pending}
        dir="ltr"
        onChange={(event) => {
          const nextLocale = event.target.value;
          setError("");
          startTransition(() => {
            // Keep deep links, filters, payment results and the current anchor.
            try {
              router.replace(
                `${pathname}${window.location.search}${window.location.hash}`,
                { locale: nextLocale, scroll: false },
              );
            } catch {
              setError(copy("请求失败"));
            }
          });
        }}
      >
        {locales.map((language) => (
          <option key={language} value={language} lang={language}>
            {localeNames[language as keyof typeof localeNames]}
          </option>
        ))}
      </select>
      <span className="sr-only" aria-live="polite">
        {pending ? copy("正在切换语言…") : error}
      </span>
    </div>
  );
}
