import { Languages } from "lucide-vue-next";
import { defineComponent, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import { localeNames, locales } from "../i18n/locales.mjs";
import { useCopy, useLocale } from "./i18n";
import { localizedPath, stripLocale } from "./routing";
export default defineComponent(
  () => {
    const locale = useLocale(),
      copy = useCopy(),
      router = useRouter();
    const pending = ref(false),
      error = ref("");
    async function change(event: Event) {
      const control = event.target as HTMLSelectElement;
      const next = control.value;
      const hadFocus = document.activeElement === control;
      pending.value = true;
      error.value = "";
      try {
        await router.replace(
          localizedPath(stripLocale(router.currentRoute.value.fullPath), next),
        );
      } catch {
        error.value = copy("请求失败");
      } finally {
        pending.value = false;
        await nextTick();
        // Disabling the native select blurs it; restore only if the user has
        // not moved on to another control during the dictionary request.
        if (
          hadFocus &&
          control.isConnected &&
          document.activeElement === document.body
        )
          control.focus({ preventScroll: true });
      }
    }
    return () => (
      <div class="language-switcher">
        <Languages size={17} aria-hidden="true" />
        <select
          aria-label={copy("选择语言")}
          value={locale.value}
          disabled={pending.value}
          dir="ltr"
          onChange={change}
        >
          {locales.map((language) => (
            <option
              key={language}
              value={language}
              lang={language}
              selected={language === locale.value}
            >
              {localeNames[language as keyof typeof localeNames]}
            </option>
          ))}
        </select>
        <span class="sr-only" aria-live="polite">
          {pending.value ? copy("正在切换语言…") : error.value}
        </span>
      </div>
    );
  },
  { name: "LanguageSwitcher" },
);
