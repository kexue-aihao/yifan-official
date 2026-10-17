import {
  computed,
  inject,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
  type InjectionKey,
} from "vue";
import { defaultTheme, isTheme, themeCookie, type ThemeId } from "./themes";
type Appearance = {
  theme: ThemeId;
  preferred: ThemeId | null;
  siteTheme: ThemeId;
  choose: (theme: ThemeId | null) => void;
  setSiteTheme: (theme: unknown) => void;
};
const key: InjectionKey<Appearance> = Symbol("appearance");
export function useTheme() {
  return inject(key)!;
}
export function provideTheme(
  initialTheme: ThemeId,
  preference: ThemeId | null,
) {
  const siteTheme = ref(initialTheme),
    preferred = ref(preference);
  const theme = computed(() => preferred.value || siteTheme.value);
  const state = reactive({
    theme,
    preferred,
    siteTheme,
    setSiteTheme(value: unknown) {
      siteTheme.value = isTheme(value) ? value : defaultTheme;
    },
    choose(value: ThemeId | null) {
      preferred.value = value;
      document.cookie = `${themeCookie}=${value || ""}; Path=/; Max-Age=${value ? 31536000 : 0}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    },
  });
  provide(key, state);
  onMounted(() =>
    watch(
      theme,
      (value) => {
        document.documentElement.dataset.theme = value;
        const scheme = value === "noir" ? "dark" : "light";
        document.documentElement.style.colorScheme = scheme;
        const color = getComputedStyle(document.documentElement)
          .getPropertyValue("--paper")
          .trim();
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", color);
        document
          .querySelector('meta[name="color-scheme"]')
          ?.setAttribute("content", scheme);
      },
      { immediate: true },
    ),
  );
  return state;
}
