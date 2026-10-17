import { createSSRApp, defineComponent, h } from "vue";
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  RouterView,
  type RouteRecordRaw,
} from "vue-router";
import { defaultLocale, locales } from "../i18n/locales.mjs";
import App, { Protected } from "./App";
import { useDialogFocusTracking, useRouteFocus } from "./focus";
import type { InitialState } from "./context";
import { provideI18n, loadLocale, registerMessages, useCopy } from "./i18n";
import { provideSite } from "./lib";
import { provideMedia } from "./MediaProvider";
import { provideRouteTransitions } from "./RouteTransitions";
import { stripLocale } from "./routing";
import { provideTheme } from "./ThemeProvider";
import Home from "./views/Home";
const pages = [
  { path: "/", component: Home },
  { path: "/services", component: () => import("./views/Services") },
  { path: "/portfolio", component: () => import("./views/Portfolio") },
  { path: "/community", component: () => import("./views/Community") },
  { path: "/community/:id", component: () => import("./views/Community") },
  { path: "/login", component: () => import("./views/Auth") },
  { path: "/register", component: () => import("./views/Auth") },
  {
    path: "/account",
    component: () => import("./views/Account"),
    meta: { protected: true },
  },
  {
    path: "/admin",
    component: () => import("./views/Admin"),
    meta: { protected: true, admin: true },
  },
  { path: "/privacy", component: () => import("./views/Legal") },
  { path: "/terms", component: () => import("./views/Legal") },
  {
    path: "/install",
    component: () => import("./views/Install"),
    meta: { install: true },
  },
];
export function createApplication(initial: InitialState, ssr = false) {
  registerMessages(initial.locale, initial.messages);
  const routes: RouteRecordRaw[] = locales.flatMap((locale) =>
    pages.map((page) => ({
      ...page,
      path:
        locale === defaultLocale
          ? page.path
          : `/${locale}${page.path === "/" ? "" : page.path}`,
    })),
  );
  routes.push({
    path: "/:pathMatch(.*)*",
    meta: { standalone: true },
    component: defineComponent(() => {
      const copy = useCopy();
      return () => (
        <div class="page container">
          <h1>{copy("这一页，暂未定格。")}</h1>
          <a href="/">YI FAN</a>
        </div>
      );
    }),
  });
  const router = createRouter({
    history: ssr ? createMemoryHistory() : createWebHistory(),
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved;
      if (to.hash)
        return {
          el: to.hash,
          top: 100,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        };
      if (to.path === from.path) return false;
      return { top: 0, behavior: "instant" };
    },
  });
  router.beforeEach(async (to) => {
    const first = to.path.split("/")[1];
    await loadLocale(locales.includes(first) ? first : defaultLocale);
  });
  const Shell = defineComponent(() => {
    provideRouteTransitions(router);
    provideSite();
    const view = () => (
      <RouterView
        v-slots={{
          default: ({ Component, route }: any) => {
            if (!Component) return null;
            const content = route.meta.protected ? (
              <Protected admin={route.meta.admin}>{h(Component)}</Protected>
            ) : (
              h(Component)
            );
            return (
              <div key={stripLocale(route.path)} class="route-stage route-page">
                {content}
              </div>
            );
          },
        }}
      />
    );
    return () =>
      router.currentRoute.value.meta.install ||
      router.currentRoute.value.meta.standalone ? (
        view()
      ) : (
        <App>{view()}</App>
      );
  });
  const Root = defineComponent(() => {
    useDialogFocusTracking();
    useRouteFocus(router);
    provideI18n();
    provideTheme(initial.siteTheme, initial.preference);
    provideMedia(initial.images);
    return () => <Shell />;
  });
  const app = createSSRApp(Root);
  app.use(router);
  return { app, router };
}
