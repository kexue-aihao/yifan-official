import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  LoaderCircle,
  LockKeyhole,
} from "lucide-vue-next";
import { AnimatePresence, motion, MotionConfig } from "motion-v";
import {
  computed,
  defineComponent,
  onMounted,
  ref as vueRef,
  watch,
} from "vue";
import { useCopy, useLocale } from "../i18n";
import LanguageSwitcher from "../LanguageSwitcher";
import { Link } from "../routing";
type Connection = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  tls: boolean;
};
type Verification = {
  database: string;
  version: string;
  charset: string;
  verificationToken: string;
};
const Install = defineComponent(
  () => {
    const copy = useCopy();
    const locale = useLocale();
    const step = vueRef(0);
    const installed = vueRef(false);
    const checking = vueRef(true);
    const error = vueRef("");
    const busy = vueRef(false);
    const csrf = vueRef("");
    const key = vueRef("");
    const database = vueRef<Connection>({
      host: "127.0.0.1",
      port: 3306,
      database: "yifan",
      user: "yifan",
      password: "",
      tls: false,
    });
    const verified = vueRef<Verification | null>(null);
    const origin = vueRef("");
    onMounted(() => {
      watch(
        () => [],
        () => {
          origin.value = window.location.origin;
          fetch("/api/install/status")
            .then(async (r) => {
              if (!r.ok)
                throw new Error(copy("无法获取安装状态，请检查网站服务。"));
              return r.json();
            })
            .then((s) => (installed.value = s.installed))
            .catch((e) => (error.value = e.message))
            .finally(() => (checking.value = false));
        },
        { immediate: true, flush: "post" },
      );
    });
    async function request(path: string, body: unknown) {
      const response = await fetch(`/api/install/${path}`, {
        method: "POST",
        headers: {
          "Accept-Language": locale.value,
          "content-type": "application/json",
          ...(csrf.value ? { "x-install-csrf": csrf.value } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || copy("操作未完成，请稍后重试。"));
      return data;
    }
    function update<K extends keyof Connection>(
      field: K,
      value: Connection[K],
    ) {
      database.value = ((v) => ({ ...v, [field]: value }))(database.value);
      verified.value = null;
      error.value = "";
    }
    async function run(fn: () => Promise<void>) {
      busy.value = true;
      error.value = "";
      try {
        await fn();
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    const titles = computed(() => [
      "准备安装",
      "核实数据库",
      "站点与管理员",
      "安装完成",
    ]);
    return () => {
      if (checking.value)
        return (
          <div class="install-loading">
            <LoaderCircle class="spin" />
            {copy("正在检查安装状态")}
          </div>
        );
      return (
        <MotionConfig reducedMotion="user">
          <main class="install-page">
            <aside class="install-aside">
              <Link class="install-brand" to="/">
                壹梵定制<span>YI FAN</span>
              </Link>
              <div>
                <p>{copy("让美好，从这里开始。")}</p>
                <h1>
                  {copy("每一个故事，")}
                  <br />
                  {copy("都值得被珍藏。")}
                </h1>
              </div>
              <small>{copy("Wedding · Portrait · Bespoke experiences")}</small>
            </aside>
            <section class="install-workspace">
              <div class="install-content">
                <div class="install-topline">
                  <span>{copy("网站安装向导")}</span>
                  <LanguageSwitcher />
                  <LockKeyhole size={18} />
                </div>
                {installed.value || step.value === 3 ? (
                  <div class="install-success">
                    <span class="success-seal">
                      <Check />
                    </span>
                    <h2>
                      {step.value === 3
                        ? copy("壹梵，已准备就绪。")
                        : copy("网站已完成安装")}
                    </h2>
                    <p>
                      {copy(
                        "安装入口已锁定。你可以登录管理后台，设置服务、预约时段与在线支付。",
                      )}
                    </p>
                    <Link class="button" to="/login?next=/admin">
                      {copy("登录管理后台")}
                      <ArrowRight size={17} />
                    </Link>
                    <Link class="under-link" to="/">
                      {copy("浏览网站")}
                    </Link>
                  </div>
                ) : (
                  <>
                    <ol class="install-steps" aria-label={copy("安装进度")}>
                      {titles.value.slice(0, 3).map((title, index) => (
                        <li
                          key={title}
                          class={
                            index === step.value
                              ? "current"
                              : index < step.value
                                ? "done"
                                : ""
                          }
                          aria-current={
                            index === step.value ? "step" : undefined
                          }
                        >
                          <span>
                            {index < step.value ? (
                              <Check size={14} />
                            ) : (
                              index + 1
                            )}
                          </span>
                          {copy(title)}
                        </li>
                      ))}
                    </ol>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={step.value}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -15 }}
                        transition={{ duration: 0.25 }}
                      >
                        {step.value === 0 && (
                          <form
                            onSubmit={(e: SubmitEvent) => {
                              e.preventDefault();
                              void run(async () => {
                                const s = await request("session", {
                                  key: key.value,
                                });
                                csrf.value = s.csrf;
                                key.value = "";
                                step.value = 1;
                              });
                            }}
                          >
                            <h2>{copy("欢迎，壹梵的主理人。")}</h2>
                            <p class="install-description">
                              {copy("几步完成网站配置，开启你的品牌空间。")}
                            </p>
                            <div class="install-note">
                              <Database size={22} />
                              <div>
                                <strong>{copy("请先创建 MySQL 数据库")}</strong>
                                <p>
                                  {copy(
                                    "需要 MySQL 8.0 或以上、utf8mb4 字符集和独立的空数据库。准备好数据库账号，下一步会实际核实连接与读写权限。",
                                  )}
                                </p>
                              </div>
                            </div>
                            <label>
                              {copy("安装密钥")}
                              <input
                                disabled={busy.value}
                                aria-label={copy("安装密钥")}
                                type="password"
                                required
                                value={key.value}
                                autocomplete="off"
                                onInput={(e) =>
                                  (key.value = (
                                    e.target as HTMLInputElement
                                  ).value)
                                }
                              />
                              <small>
                                {copy(
                                  "在服务器的 data/install.key 文件中查看。该密钥仅用于首次安装。",
                                )}
                              </small>
                            </label>
                            <button class="button" disabled={busy.value}>
                              {busy.value ? (
                                <LoaderCircle class="spin" size={18} />
                              ) : (
                                <>
                                  {copy("开始配置")}
                                  <ArrowRight size={17} />
                                </>
                              )}
                            </button>
                          </form>
                        )}
                        {step.value === 1 && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              verified.value = null;
                              void run(async () => {
                                verified.value = await request(
                                  "verify",
                                  database.value,
                                );
                              });
                            }}
                          >
                            <h2>{copy("连接你的数据库。")}</h2>
                            <p class="install-description">
                              {copy(
                                "数据库必须提前创建。我们将连接 MySQL，核实库名、版本与实际操作权限。",
                              )}
                            </p>
                            <div class="form-grid">
                              <label>
                                {copy("数据库主机")}
                                <input
                                  disabled={busy.value}
                                  required
                                  value={database.value.host}
                                  onInput={(e) =>
                                    update(
                                      "host",
                                      (e.target as HTMLInputElement).value,
                                    )
                                  }
                                  autocomplete="off"
                                />
                              </label>
                              <label>
                                {copy("端口")}
                                <input
                                  disabled={busy.value}
                                  required
                                  type="number"
                                  min={1}
                                  max={65535}
                                  value={database.value.port}
                                  onInput={(e) =>
                                    update(
                                      "port",
                                      Number(
                                        (e.target as HTMLInputElement).value,
                                      ),
                                    )
                                  }
                                />
                              </label>
                            </div>
                            <label>
                              {copy("已创建的数据库名称")}
                              <input
                                disabled={busy.value}
                                required
                                value={database.value.database}
                                pattern="[a-zA-Z0-9_]{1,64}"
                                onInput={(e) =>
                                  update(
                                    "database",
                                    (e.target as HTMLInputElement).value,
                                  )
                                }
                                autocomplete="off"
                              />
                            </label>
                            <div class="form-grid">
                              <label>
                                {copy("数据库用户名")}
                                <input
                                  disabled={busy.value}
                                  required
                                  value={database.value.user}
                                  onInput={(e) =>
                                    update(
                                      "user",
                                      (e.target as HTMLInputElement).value,
                                    )
                                  }
                                  autocomplete="off"
                                />
                              </label>
                              <label>
                                {copy("数据库密码")}
                                <input
                                  disabled={busy.value}
                                  type="password"
                                  value={database.value.password}
                                  onInput={(e) =>
                                    update(
                                      "password",
                                      (e.target as HTMLInputElement).value,
                                    )
                                  }
                                  autocomplete="off"
                                />
                              </label>
                            </div>
                            <label class="check-label">
                              <input
                                disabled={busy.value}
                                type="checkbox"
                                checked={database.value.tls}
                                onInput={(e) =>
                                  update(
                                    "tls",
                                    (e.target as HTMLInputElement).checked,
                                  )
                                }
                              />
                              {copy("使用 TLS 加密连接（验证服务器证书）")}
                            </label>
                            {verified.value && (
                              <div class="install-verified" role="status">
                                <Check size={20} />
                                <div>
                                  <strong>
                                    {copy("数据库真实性核实通过")}
                                  </strong>
                                  <p>
                                    {copy("{v0} · MySQL{v1} · {v2}", {
                                      v0: verified.value.database,
                                      v1: verified.value.version,
                                      v2: verified.value.charset,
                                    })}
                                    <br />
                                    {copy(
                                      "已完成临时表创建、读写、索引和删除验证。",
                                    )}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div class="install-actions">
                              <button
                                class="button outline"
                                disabled={busy.value}
                                type="submit"
                              >
                                {busy.value
                                  ? copy("正在连接并核实…")
                                  : verified.value
                                    ? copy("重新核实")
                                    : copy("核实数据库")}
                              </button>
                              <button
                                class="button"
                                disabled={!verified.value || busy.value}
                                type="button"
                                onClick={() => {
                                  error.value = "";
                                  step.value = 2;
                                }}
                              >
                                {copy("下一步")}
                                <ArrowRight size={17} />
                              </button>
                            </div>
                          </form>
                        )}
                        {step.value === 2 && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = new FormData(
                                e.currentTarget as HTMLFormElement,
                              );
                              void run(async () => {
                                if (
                                  form.get("adminPassword") !==
                                  form.get("confirmPassword")
                                )
                                  throw new Error(
                                    copy("两次管理员密码不一致。"),
                                  );
                                await request("complete", {
                                  verificationToken:
                                    verified.value?.verificationToken,
                                  siteOrigin: origin.value,
                                  adminName: form.get("adminName"),
                                  adminEmail: form.get("adminEmail"),
                                  adminPassword: form.get("adminPassword"),
                                });
                                database.value = ((v) => ({
                                  ...v,
                                  password: "",
                                }))(database.value);
                                step.value = 3;
                              });
                            }}
                          >
                            <h2>{copy("为品牌，开启新一章。")}</h2>
                            <p class="install-description">
                              {copy(
                                "设置网站地址与首位管理员。完成时将再次核实数据库，并创建业务数据表。",
                              )}
                            </p>
                            <label>
                              {copy("站点地址")}
                              <input
                                disabled={busy.value}
                                aria-label={copy("站点地址")}
                                type="url"
                                required
                                value={origin.value}
                                readonly
                              />
                              <small>
                                {copy(
                                  "使用当前访问域名，确保预约、会话和支付回调地址一致。",
                                )}
                              </small>
                            </label>
                            <div class="form-grid">
                              <label>
                                {copy("管理员称呼")}
                                <input
                                  disabled={busy.value}
                                  name="adminName"
                                  required
                                  maxlength={30}
                                  autocomplete="name"
                                />
                              </label>
                              <label>
                                {copy("管理员邮箱")}
                                <input
                                  disabled={busy.value}
                                  type="email"
                                  name="adminEmail"
                                  required
                                  maxlength={160}
                                  autocomplete="username"
                                />
                              </label>
                            </div>
                            <label>
                              {copy("管理员密码")}
                              <input
                                disabled={busy.value}
                                aria-label={copy("管理员密码")}
                                type="password"
                                name="adminPassword"
                                required
                                minlength={12}
                                maxlength={128}
                                autocomplete="new-password"
                              />
                              <small>
                                {copy("至少 12 位，请使用独立的管理密码。")}
                              </small>
                            </label>
                            <label>
                              {copy("确认密码")}
                              <input
                                disabled={busy.value}
                                type="password"
                                name="confirmPassword"
                                required
                                minlength={12}
                                autocomplete="new-password"
                              />
                            </label>
                            <div class="install-actions">
                              <button
                                class="text-button"
                                type="button"
                                disabled={busy.value}
                                onClick={() => {
                                  error.value = "";
                                  step.value = 1;
                                }}
                              >
                                <ArrowLeft size={16} />
                                {copy("返回数据库配置")}
                              </button>
                              <button class="button" disabled={busy.value}>
                                {busy.value ? (
                                  <>
                                    <LoaderCircle class="spin" size={18} />
                                    {copy("正在安装…")}
                                  </>
                                ) : (
                                  <>
                                    {copy("完成安装")}
                                    <ArrowRight size={17} />
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </>
                )}
                {error.value && (
                  <div class="error-notice" role="alert">
                    {copy(error.value)}
                  </div>
                )}
                <p class="install-footnote">
                  {copy("壹梵定制 YI FAN · 为每一个独特的你")}
                </p>
              </div>
            </section>
          </main>
        </MotionConfig>
      );
    };
  },
  { name: "Install", props: [] },
);
export default Install;
