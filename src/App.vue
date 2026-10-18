<script lang="tsx">
import {
  ArrowUpRight,
  LogOut,
  Menu,
  MessageCircle,
  UserRound,
  X,
} from "lucide-vue-next";
import { MotionConfig } from "motion-v";
import {
  defineComponent,
  onMounted,
  ref as vueRef,
  Transition,
  watch,
  type VNodeChild,
} from "vue";
import { Loading } from "./components.vue";
import { useCopy } from "./i18n.vue";
import LanguageSwitcher from "./LanguageSwitcher.vue";
import { useSite } from "./lib.vue";
import { RouteTransitions } from "./RouteTransitions.vue";
import { Link, NavLink, Navigate, useLocation } from "./routing.vue";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import Chat from "./views/Chat.vue";
import VisitTracker from "./VisitTracker.vue";
const Brand = defineComponent(
  () => {
    const copy = useCopy();
    return () => (
      <Link to="/" class="brand" aria-label={copy("壹梵定制首页")}>
        <span class="brand-symbol">
          Y<span>F</span>
        </span>
        <span class="brand-type">
          壹梵定制<small>{copy("YI FAN / Wedding & Portrait")}</small>
        </span>
      </Link>
    );
  },
  { name: "Brand", props: [] },
);
export const Protected = defineComponent(
  (
    props: {
      children?: VNodeChild;
      admin?: boolean;
    },
    { slots: componentSlots },
  ) => {
    const copy = useCopy();
    const site = useSite();
    const location = useLocation();
    return () => {
      if (site.loading) return <Loading />;
      if (!site.user)
        return (
          <Navigate
            to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
            replace
          />
        );
      if ((props.admin ?? false) && site.user.role !== "admin")
        return (
          <div class="page container">
            <h1>{copy("此页面需要管理员权限")}</h1>
            <Link class="button" to="/">
              {copy("返回首页")}
            </Link>
          </div>
        );
      return componentSlots.default?.();
    };
  },
  { name: "Protected", props: ["admin"] },
);
const App = defineComponent(
  (
    _props: {
      children?: VNodeChild;
    },
    { slots: componentSlots },
  ) => {
    const copy = useCopy();
    const site = useSite();
    const menu = vueRef(false);
    const error = vueRef("");
    const location = useLocation();
    onMounted(() => {
      watch(
        () => [location.pathname, location.hash],
        () => {
          menu.value = false;
        },
        { immediate: true, flush: "post" },
      );
    });
    return () => (
      <MotionConfig reducedMotion="user">
        <RouteTransitions>
          <VisitTracker />
          <a href="#main" class="skip-link">
            {copy("跳至主要内容")}
          </a>
          <header class="header">
            <div class="header-inner">
              <Brand />
              <nav
                id="primary-navigation"
                class={menu.value ? "nav open" : "nav"}
                aria-label={copy("主导航")}
                onKeydown={(event) => {
                  if (event.key === "Escape") {
                    menu.value = false;
                    document
                      .querySelector<HTMLButtonElement>(".menu-toggle")
                      ?.focus();
                  }
                }}
              >
                <NavLink to="/" end>
                  {copy("首页")}
                </NavLink>
                <NavLink to="/services">{copy("定制服务")}</NavLink>
                <NavLink to="/portfolio">{copy("影像作品")}</NavLink>
                <NavLink to="/community">{copy("壹梵社区")}</NavLink>
                <Link to="/#our-story">{copy("关于壹梵")}</Link>
              </nav>
              <div class="header-actions">
                <ThemeSwitcher />
                <LanguageSwitcher />
                {site.user ? (
                  <>
                    <Link
                      class="account-link"
                      to="/account"
                      aria-label={site.user.name}
                    >
                      <UserRound size={17} />
                      <span>{site.user.name}</span>
                    </Link>
                    {site.user.role === "admin" && (
                      <Link class="admin-link" to="/admin">
                        {copy("管理后台")}
                      </Link>
                    )}
                    <button
                      class="icon-button logout"
                      aria-label={copy("退出登录")}
                      onClick={() =>
                        void site
                          .logout()
                          .catch((e) => (error.value = e.message))
                      }
                    >
                      <LogOut size={16} />
                    </button>
                  </>
                ) : (
                  <Link
                    class="account-link"
                    to="/login"
                    aria-label={copy("登录 / 注册")}
                  >
                    <UserRound size={17} />
                    <span>{copy("登录 / 注册")}</span>
                  </Link>
                )}
                <Link to="/services" class="button small header-book">
                  {copy("预约体验")}
                  <ArrowUpRight size={15} />
                </Link>
                <button
                  class="icon-button menu-toggle"
                  onClick={() => (menu.value = !menu.value)}
                  aria-expanded={menu.value}
                  aria-controls="primary-navigation"
                  aria-label={menu.value ? copy("关闭导航") : copy("打开导航")}
                >
                  {menu.value ? <X /> : <Menu />}
                </button>
              </div>
            </div>
          </header>
          {(site.siteError || error.value) && (
            <div class="site-error" role="alert">
              {copy(site.siteError || error.value)}{" "}
              <button
                onClick={() => {
                  error.value = "";
                  void site.refreshSite();
                }}
              >
                {copy("重新连接")}
              </button>
            </div>
          )}
          <main id="main" tabindex={-1}>
            {componentSlots.default?.()}
          </main>
          <footer class="footer">
            <div class="container footer-main">
              <div>
                <Brand />
                <p>
                  {copy("为每一个你，定格不凡。")}
                  <br />
                  {copy("婚纱 · 影像 · 造型 · 庆典")}
                </p>
              </div>
              <div>
                <h3>{copy("探索壹梵")}</h3>
                <Link to="/services">{copy("专属定制服务")}</Link>
                <Link to="/portfolio">{copy("影像灵感画廊")}</Link>
                <Link to="/community">{copy("壹梵的日常")}</Link>
              </div>
              <div>
                <h3>{copy("与你相遇")}</h3>
                <button class="text-button" onClick={() => site.openChat()}>
                  {copy("在线咨询")}
                  <ArrowUpRight size={14} />
                </button>
                <p>
                  {site.settings?.site.phone ||
                    copy("预约咨询后，为你安排专属沟通")}
                </p>
                {site.settings?.site.wechat && (
                  <p>
                    {copy("微信咨询：{v0}", {
                      v0: site.settings.site.wechat,
                    })}
                  </p>
                )}
                <p>
                  {site.settings?.site.address || copy("到店信息请向客服咨询")}
                </p>
                <p>
                  {copy("服务时间")}{" "}
                  {site.settings?.site.hours || "10:00 — 20:00"}
                </p>
              </div>
              <div class="footer-note">
                <span class="serif">
                  {copy("A moment.")}
                  <br />
                  <i>{copy("A lifetime.")}</i>
                </span>
                <span>{copy("美，始于你本来的样子。")}</span>
              </div>
            </div>
            <div class="container footer-bottom">
              <span>
                {copy("© {v0} 壹梵定制 YI FAN. 保留所有权利。", {
                  v0: new Date().getFullYear(),
                })}
              </span>
              <div>
                <Link to="/privacy">{copy("隐私说明")}</Link>
                <Link to="/terms">{copy("预约须知")}</Link>
                <Link to="/admin">{copy("管理入口")}</Link>
              </div>
            </div>
          </footer>
          <button
            class={`chat-launcher ${site.chatOpen ? "hidden" : ""}`}
            onClick={() => site.openChat()}
            aria-label={copy("打开专属客服")}
            aria-expanded={site.chatOpen}
            aria-controls="chat-panel"
          >
            <MessageCircle size={21} strokeWidth={1.5} />
            <span>{copy("专属顾问")}</span>
          </button>
          <Transition name="chat-flow">
            {site.chatOpen ? <Chat /> : null}
          </Transition>
        </RouteTransitions>
      </MotionConfig>
    );
  },
  { name: "App", props: [] },
);
export default App;
</script>
