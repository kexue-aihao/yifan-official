<script lang="tsx">
import {
  computed,
  defineComponent,
  onMounted,
  reactive,
  type AnchorHTMLAttributes,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { defaultLocale, locales } from "../i18n/locales.mjs";
import { useLocale } from "./i18n.vue";
import { useRouteTransition } from "./RouteTransitions.vue";
export function stripLocale(path: string) {
  const match = /^\/([^/?#]+)(.*)$/.exec(path);
  return match && locales.includes(match[1])
    ? (match[2].startsWith("/") ? match[2] : "/" + match[2]) || "/"
    : path;
}
export function localizedPath(path: string, locale: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const clean = stripLocale(path);
  return locale === defaultLocale
    ? clean
    : `/${locale}${clean === "/" ? "" : clean}`;
}
type LinkProps = {
  to: string;
  end?: boolean;
} & AnchorHTMLAttributes;
export const Link = defineComponent(
  (props: LinkProps, { attrs, slots }) => {
    const router = useRouter(),
      locale = useLocale(),
      transition = useRouteTransition();
    const href = computed(() => localizedPath(props.to, locale.value));
    async function click(event: MouseEvent) {
      if (typeof attrs.onClick === "function") attrs.onClick(event);
      else if (Array.isArray(attrs.onClick))
        attrs.onClick.forEach((handler) => handler(event));
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        attrs.target === "_blank" ||
        attrs.download !== undefined
      )
        return;
      const url = new URL(href.value, location.href);
      if (url.origin !== location.origin) return;
      event.preventDefault();
      const commit = () => router.push(url.pathname + url.search + url.hash);
      if (url.pathname !== location.pathname) await transition.navigate(commit);
      else {
        transition.cancel();
        await commit();
      }
    }
    return () => (
      <a {...attrs} href={href.value} onClick={click}>
        {slots.default?.()}
      </a>
    );
  },
  { name: "SiteLink", inheritAttrs: false, props: ["to", "end"] },
);
export const NavLink = defineComponent(
  (props: LinkProps, { attrs, slots }) => {
    const location = useLocation();
    return () => (
      <Link
        {...attrs}
        to={props.to}
        class={[attrs.class, location.pathname === props.to ? "active" : ""]}
        aria-current={location.pathname === props.to ? "page" : undefined}
      >
        {slots.default?.()}
      </Link>
    );
  },
  { name: "NavLink", inheritAttrs: false, props: ["to", "end"] },
);
export function useLocation() {
  const route = useRoute();
  return reactive({
    pathname: computed(() => stripLocale(route.path)),
    search: computed(() => {
      const query = route.fullPath.split("?")[1]?.split("#")[0];
      return query ? "?" + query : "";
    }),
    hash: computed(() => route.hash),
  });
}
export function useNavigate() {
  const router = useRouter(),
    locale = useLocale(),
    transition = useRouteTransition();
  return (
    to: string,
    options?: {
      replace?: boolean;
    },
  ) => {
    const url = localizedPath(to, locale.value);
    const commit = () =>
      options?.replace ? router.replace(url) : router.push(url);
    if (
      typeof window !== "undefined" &&
      url.split(/[?#]/)[0] !== location.pathname
    )
      void transition.navigate(commit);
    else {
      transition.cancel();
      void commit();
    }
  };
}
export const Navigate = defineComponent(
  (props: { to: string; replace?: boolean }) => {
    const navigate = useNavigate();
    onMounted(() => navigate(props.to, { replace: props.replace }));
    return () => null;
  },
  { name: "Navigate", props: ["to", "replace"] },
);
export function useSearchParams() {
  const route = useRoute(),
    router = useRouter();
  const params = computed(
    () =>
      new URLSearchParams(route.fullPath.split("?")[1]?.split("#")[0] || ""),
  );
  const set = (
    value: URLSearchParams,
    options?: {
      replace?: boolean;
    },
  ) => {
    const url = `${route.path}${value.size ? "?" + value : ""}${route.hash}`;
    void (options?.replace ? router.replace(url) : router.push(url));
  };
  return [params, set] as const;
}
export function useParams() {
  const route = useRoute();
  return reactive({
    id: computed(() => route.params.id as string | undefined),
  });
}

export default {};
</script>
