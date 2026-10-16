"use client";
import {SiteImage} from '../MediaProvider';
import { useCopy } from "../i18n";

import { useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "../routing";
import { Eye, EyeOff } from "lucide-react";
import { useSite } from "../lib";
import { Arrow, ErrorNotice, Loading } from "../components";
import ConsentText from "../ConsentText";

export default function Auth() {
  const copy = useCopy();
  const { user, loading, authenticate } = useSite();
  const location = useLocation();
  const register = location.pathname === "/register";
  const [params] = useSearchParams();
  const rawNext = params.get("next") || "/account";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("\\")
      ? rawNext
      : "/account";
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  if (loading) return <Loading />;
  if (user) return <Navigate to={next} replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await authenticate(register ? "register" : "login", {
        email: form.get("email"),
        password: form.get("password"),
        ...(register
          ? { name: form.get("name"), consent: form.get("consent") === "on" }
          : {}),
      });
      navigate(next, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-art">
        <SiteImage src="/images/wedding.jpg" alt={copy("浪漫婚纱影像灵感")} />
        <div>
          <span className="eyebrow">{copy("YOUR STORY BEGINS HERE")}</span>
          <h2>
            {copy("每一次相遇，")}
            <br />
            {copy("都值得用心。")}
          </h2>
          <span className="serif">
            <i>{copy("Welcome to your beautiful chapter.")}</i>
          </span>
        </div>
      </div>
      <div className="auth-form-wrap">
        <span className="eyebrow">{copy("THE YI FAN CLUB")}</span>
        <h1>
          {register ? copy("初次见面，欢迎来到壹梵。") : copy("欢迎回来。")}
        </h1>
        <p>
          {register
            ? copy("创建账户，预约专属服务，分享你的美好故事。")
            : copy("登录后，继续你的预约与美好故事。")}
        </p>
        <form
          className="form"
          onSubmit={submit}
          key={register ? "register" : "login"}
        >
          {register && (
            <label>
              {copy("你的称呼")}
              <input
                name="name"
                placeholder={copy("让我们认识你")}
                maxLength={30}
                autoComplete="nickname"
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
              maxLength={160}
              autoComplete="email"
              required
            />
          </label>
          <label>
            {copy("密码")}
            <div className="password-input">
              <input
                name="password"
                type={show ? "text" : "password"}
                placeholder={copy("至少 10 位，建议组合字母与数字")}
                minLength={10}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                required
              />
              <button
                className="icon-button"
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? copy("隐藏密码") : copy("显示密码")}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {register && (
            <label className="checkbox-label">
              <input name="consent" type="checkbox" required />
              <ConsentText />
            </label>
          )}
          <ErrorNotice error={error} />
          <button className="button full" disabled={busy}>
            {busy
              ? copy("请稍候…")
              : register
                ? copy("创建我的账户")
                : copy("登录壹梵")}
            <Arrow />
          </button>
        </form>
        <p className="auth-switch">
          {register ? copy("已有账户？") : copy("还没有账户？")}{" "}
          <Link
            to={`${register ? "/login" : "/register"}?next=${encodeURIComponent(next)}`}
            onClick={() => setError("")}
          >
            {register ? copy("前往登录") : copy("注册，开启美好")}
          </Link>
        </p>
        <Link className="subtle-link" to="/">
          {copy("继续探索壹梵")}
        </Link>
      </div>
    </div>
  );
}
