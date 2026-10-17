import { Eye, EyeOff } from "lucide-vue-next";
import { computed, defineComponent, ref as vueRef } from "vue";
import { Arrow, ErrorNotice, Loading } from "../components";
import ConsentText from "../ConsentText";
import { useCopy } from "../i18n";
import { useSite } from "../lib";
import { SiteImage } from "../MediaProvider";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "../routing";
const Auth = defineComponent(
  () => {
    const copy = useCopy();
    const site = useSite();
    const location = useLocation();
    const register = computed(() => location.pathname === "/register");
    const [params] = useSearchParams();
    const rawNext = computed(() => params.value.get("next") || "/account");
    const next = computed(() =>
      rawNext.value.startsWith("/") &&
      !rawNext.value.startsWith("//") &&
      !rawNext.value.includes("\\")
        ? rawNext.value
        : "/account",
    );
    const navigate = useNavigate();
    const error = vueRef("");
    const busy = vueRef(false);
    const show = vueRef(false);
    async function submit(e: SubmitEvent) {
      e.preventDefault();
      const form = new FormData(e.currentTarget as HTMLFormElement);
      busy.value = true;
      error.value = "";
      try {
        await site.authenticate(register.value ? "register" : "login", {
          email: form.get("email"),
          password: form.get("password"),
          ...(register.value
            ? { name: form.get("name"), consent: form.get("consent") === "on" }
            : {}),
        });
        navigate(next.value, { replace: true });
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    return () => {
      if (site.loading) return <Loading />;
      if (site.user) return <Navigate to={next.value} replace />;
      return (
        <div class="auth-page">
          <div class="auth-art">
            <SiteImage
              src="/images/wedding.jpg"
              alt={copy("浪漫婚纱影像灵感")}
            />
            <div>
              <span class="eyebrow">{copy("YOUR STORY BEGINS HERE")}</span>
              <h2>
                {copy("每一次相遇，")}
                <br />
                {copy("都值得用心。")}
              </h2>
              <span class="serif">
                <i>{copy("Welcome to your beautiful chapter.")}</i>
              </span>
            </div>
          </div>
          <div class="auth-form-wrap">
            <span class="eyebrow">{copy("THE YI FAN CLUB")}</span>
            <h1>
              {register.value
                ? copy("初次见面，欢迎来到壹梵。")
                : copy("欢迎回来。")}
            </h1>
            <p>
              {register.value
                ? copy("创建账户，预约专属服务，分享你的美好故事。")
                : copy("登录后，继续你的预约与美好故事。")}
            </p>
            <form
              class="form"
              onSubmit={submit}
              key={register.value ? "register" : "login"}
            >
              {register.value && (
                <label>
                  {copy("你的称呼")}
                  <input
                    name="name"
                    placeholder={copy("让我们认识你")}
                    maxlength={30}
                    autocomplete="nickname"
                    required
                  />
                </label>
              )}
              <label>
                {copy("邮箱地址")}
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  maxlength={160}
                  autocomplete="email"
                  required
                />
              </label>
              <label>
                {copy("密码")}
                <div class="password-input">
                  <input
                    name="password"
                    type={show.value ? "text" : "password"}
                    placeholder={copy("至少 10 位，建议组合字母与数字")}
                    minlength={10}
                    maxlength={128}
                    autocomplete={
                      register.value ? "new-password" : "current-password"
                    }
                    required
                  />
                  <button
                    class="icon-button"
                    type="button"
                    onClick={() => (show.value = !show.value)}
                    aria-label={
                      show.value ? copy("隐藏密码") : copy("显示密码")
                    }
                  >
                    {show.value ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {register.value && (
                <label class="checkbox-label">
                  <input name="consent" type="checkbox" required />
                  <ConsentText />
                </label>
              )}
              <ErrorNotice error={error.value} />
              <button class="button full" disabled={busy.value}>
                {busy.value
                  ? copy("请稍候…")
                  : register.value
                    ? copy("创建我的账户")
                    : copy("登录壹梵")}
                <Arrow />
              </button>
            </form>
            <p class="auth-switch">
              {register.value ? copy("已有账户？") : copy("还没有账户？")}{" "}
              <Link
                to={`${register.value ? "/login" : "/register"}?next=${encodeURIComponent(next.value)}`}
                onClick={() => (error.value = "")}
              >
                {register.value ? copy("前往登录") : copy("注册，开启美好")}
              </Link>
            </p>
            <Link class="subtle-link" to="/">
              {copy("继续探索壹梵")}
            </Link>
          </div>
        </div>
      );
    };
  },
  { name: "Auth", props: [] },
);
export default Auth;
