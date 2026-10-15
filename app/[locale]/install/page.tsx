"use client";
import { useCopy } from "../../../src/i18n";

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "../../../i18n/navigation";
import { useLocale } from "next-intl";
import LanguageSwitcher from "../../../src/LanguageSwitcher";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  Check,
  Database,
  LockKeyhole,
  LoaderCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

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
export default function Install() {
  const copy = useCopy();
  const locale = useLocale();
  const [step, setStep] = useState(0),
    [installed, setInstalled] = useState(false),
    [checking, setChecking] = useState(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [csrf, setCsrf] = useState(""),
    [key, setKey] = useState("");
  const [database, setDatabase] = useState<Connection>({
    host: "127.0.0.1",
    port: 3306,
    database: "yifan",
    user: "yifan",
    password: "",
    tls: false,
  });
  const [verified, setVerified] = useState<Verification | null>(null),
    [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/install/status")
      .then(async (r) => {
        if (!r.ok) throw new Error(copy("无法获取安装状态，请检查网站服务。"));
        return r.json();
      })
      .then((s) => setInstalled(s.installed))
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, []);
  async function request(path: string, body: unknown) {
    const response = await fetch(`/api/install/${path}`, {
      method: "POST",
      headers: {
        "Accept-Language": locale,
        "content-type": "application/json",
        ...(csrf ? { "x-install-csrf": csrf } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || copy("操作未完成，请稍后重试。"));
    return data;
  }
  function update<K extends keyof Connection>(field: K, value: Connection[K]) {
    setDatabase((v) => ({ ...v, [field]: value }));
    setVerified(null);
    setError("");
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const titles = ["准备安装", "核实数据库", "站点与管理员", "安装完成"];
  if (checking)
    return (
      <div className="install-loading">
        <LoaderCircle className="spin" />
        {copy("正在检查安装状态")}
      </div>
    );
  return (
    <MotionConfig reducedMotion="user">
      <main className="install-page">
        <aside className="install-aside">
          <Link className="install-brand" href="/">
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
        <section className="install-workspace">
          <div className="install-content">
            <div className="install-topline">
              <span>{copy("网站安装向导")}</span>
              <LanguageSwitcher />
              <LockKeyhole size={18} />
            </div>
            {installed || step === 3 ? (
              <div className="install-success">
                <span className="success-seal">
                  <Check />
                </span>
                <h2>
                  {step === 3
                    ? copy("壹梵，已准备就绪。")
                    : copy("网站已完成安装")}
                </h2>
                <p>
                  {copy(
                    "安装入口已锁定。你可以登录管理后台，设置服务、预约时段与在线支付。",
                  )}
                </p>
                <Link className="button" href="/login?next=/admin">
                  {copy("登录管理后台")}
                  <ArrowRight size={17} />
                </Link>
                <Link className="under-link" href="/">
                  {copy("浏览网站")}
                </Link>
              </div>
            ) : (
              <>
                <ol className="install-steps" aria-label={copy("安装进度")}>
                  {titles.slice(0, 3).map((title, index) => (
                    <li
                      key={title}
                      className={
                        index === step ? "current" : index < step ? "done" : ""
                      }
                      aria-current={index === step ? "step" : undefined}
                    >
                      <span>
                        {index < step ? <Check size={14} /> : index + 1}
                      </span>
                      {copy(title)}
                    </li>
                  ))}
                </ol>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    {step === 0 && (
                      <form
                        onSubmit={(e: FormEvent<HTMLFormElement>) => {
                          e.preventDefault();
                          void run(async () => {
                            const s = await request("session", { key });
                            setCsrf(s.csrf);
                            setKey("");
                            setStep(1);
                          });
                        }}
                      >
                        <h2>{copy("欢迎，壹梵的主理人。")}</h2>
                        <p className="install-description">
                          {copy("几步完成网站配置，开启你的品牌空间。")}
                        </p>
                        <div className="install-note">
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
                            disabled={busy}
                            aria-label={copy("安装密钥")}
                            type="password"
                            required
                            value={key}
                            autoComplete="off"
                            onChange={(e) => setKey(e.target.value)}
                          />
                          <small>
                            {copy(
                              "在服务器的 data/install.key 文件中查看。该密钥仅用于首次安装。",
                            )}
                          </small>
                        </label>
                        <button className="button" disabled={busy}>
                          {busy ? (
                            <LoaderCircle className="spin" size={18} />
                          ) : (
                            <>
                              {copy("开始配置")}
                              <ArrowRight size={17} />
                            </>
                          )}
                        </button>
                      </form>
                    )}
                    {step === 1 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setVerified(null);
                          void run(async () => {
                            setVerified(await request("verify", database));
                          });
                        }}
                      >
                        <h2>{copy("连接你的数据库。")}</h2>
                        <p className="install-description">
                          {copy(
                            "数据库必须提前创建。我们将连接 MySQL，核实库名、版本与实际操作权限。",
                          )}
                        </p>
                        <div className="form-grid">
                          <label>
                            {copy("数据库主机")}
                            <input
                              disabled={busy}
                              required
                              value={database.host}
                              onChange={(e) => update("host", e.target.value)}
                              autoComplete="off"
                            />
                          </label>
                          <label>
                            {copy("端口")}
                            <input
                              disabled={busy}
                              required
                              type="number"
                              min={1}
                              max={65535}
                              value={database.port}
                              onChange={(e) =>
                                update("port", Number(e.target.value))
                              }
                            />
                          </label>
                        </div>
                        <label>
                          {copy("已创建的数据库名称")}
                          <input
                            disabled={busy}
                            required
                            value={database.database}
                            pattern="[a-zA-Z0-9_]{1,64}"
                            onChange={(e) => update("database", e.target.value)}
                            autoComplete="off"
                          />
                        </label>
                        <div className="form-grid">
                          <label>
                            {copy("数据库用户名")}
                            <input
                              disabled={busy}
                              required
                              value={database.user}
                              onChange={(e) => update("user", e.target.value)}
                              autoComplete="off"
                            />
                          </label>
                          <label>
                            {copy("数据库密码")}
                            <input
                              disabled={busy}
                              type="password"
                              value={database.password}
                              onChange={(e) =>
                                update("password", e.target.value)
                              }
                              autoComplete="off"
                            />
                          </label>
                        </div>
                        <label className="check-label">
                          <input
                            disabled={busy}
                            type="checkbox"
                            checked={database.tls}
                            onChange={(e) => update("tls", e.target.checked)}
                          />
                          {copy("使用 TLS 加密连接（验证服务器证书）")}
                        </label>
                        {verified && (
                          <div className="install-verified" role="status">
                            <Check size={20} />
                            <div>
                              <strong>{copy("数据库真实性核实通过")}</strong>
                              <p>
                                {copy("{v0} · MySQL{v1} · {v2}", {
                                  v0: verified.database,
                                  v1: verified.version,
                                  v2: verified.charset,
                                })}
                                <br />
                                {copy(
                                  "已完成临时表创建、读写、索引和删除验证。",
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="install-actions">
                          <button
                            className="button outline"
                            disabled={busy}
                            type="submit"
                          >
                            {busy
                              ? copy("正在连接并核实…")
                              : verified
                                ? copy("重新核实")
                                : copy("核实数据库")}
                          </button>
                          <button
                            className="button"
                            disabled={!verified || busy}
                            type="button"
                            onClick={() => {
                              setError("");
                              setStep(2);
                            }}
                          >
                            {copy("下一步")}
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      </form>
                    )}
                    {step === 2 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = new FormData(e.currentTarget);
                          void run(async () => {
                            if (
                              form.get("adminPassword") !==
                              form.get("confirmPassword")
                            )
                              throw new Error(copy("两次管理员密码不一致。"));
                            await request("complete", {
                              verificationToken: verified?.verificationToken,
                              siteOrigin: origin,
                              adminName: form.get("adminName"),
                              adminEmail: form.get("adminEmail"),
                              adminPassword: form.get("adminPassword"),
                            });
                            setDatabase((v) => ({ ...v, password: "" }));
                            setStep(3);
                          });
                        }}
                      >
                        <h2>{copy("为品牌，开启新一章。")}</h2>
                        <p className="install-description">
                          {copy(
                            "设置网站地址与首位管理员。完成时将再次核实数据库，并创建业务数据表。",
                          )}
                        </p>
                        <label>
                          {copy("站点地址")}
                          <input
                            disabled={busy}
                            aria-label={copy("站点地址")}
                            type="url"
                            required
                            value={origin}
                            readOnly
                          />
                          <small>
                            {copy(
                              "使用当前访问域名，确保预约、会话和支付回调地址一致。",
                            )}
                          </small>
                        </label>
                        <div className="form-grid">
                          <label>
                            {copy("管理员称呼")}
                            <input
                              disabled={busy}
                              name="adminName"
                              required
                              maxLength={30}
                              autoComplete="name"
                            />
                          </label>
                          <label>
                            {copy("管理员邮箱")}
                            <input
                              disabled={busy}
                              type="email"
                              name="adminEmail"
                              required
                              maxLength={160}
                              autoComplete="username"
                            />
                          </label>
                        </div>
                        <label>
                          {copy("管理员密码")}
                          <input
                            disabled={busy}
                            aria-label={copy("管理员密码")}
                            type="password"
                            name="adminPassword"
                            required
                            minLength={12}
                            maxLength={128}
                            autoComplete="new-password"
                          />
                          <small>
                            {copy("至少 12 位，请使用独立的管理密码。")}
                          </small>
                        </label>
                        <label>
                          {copy("确认密码")}
                          <input
                            disabled={busy}
                            type="password"
                            name="confirmPassword"
                            required
                            minLength={12}
                            autoComplete="new-password"
                          />
                        </label>
                        <div className="install-actions">
                          <button
                            className="text-button"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setStep(1);
                            }}
                          >
                            <ArrowLeft size={16} />
                            {copy("返回数据库配置")}
                          </button>
                          <button className="button" disabled={busy}>
                            {busy ? (
                              <>
                                <LoaderCircle className="spin" size={18} />
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
            {error && (
              <div className="error-notice" role="alert">
                {copy(error)}
              </div>
            )}
            <p className="install-footnote">
              {copy("壹梵定制 YI FAN · 为每一个独特的你")}
            </p>
          </div>
        </section>
      </main>
    </MotionConfig>
  );
}
