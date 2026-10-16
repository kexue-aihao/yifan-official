"use client";
import { useCopy } from "./i18n";

import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "./routing";
import {
  Menu,
  X,
  UserRound,
  MessageCircle,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { useSite } from "./lib";
import { Loading } from "./components";
import Chat from "./views/Chat";
import { MotionConfig } from "motion/react";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeSwitcher from "./ThemeSwitcher";
import VisitTracker from './VisitTracker';

function Brand() {
  const copy = useCopy();
  return (
    <Link to="/" className="brand" aria-label={copy("壹梵定制首页")}>
      <span className="brand-symbol">
        Y<span>F</span>
      </span>
      <span className="brand-type">
        壹梵定制<small>{copy("YI FAN / Wedding & Portrait")}</small>
      </span>
    </Link>
  );
}
export function Protected({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const copy = useCopy();
  const { user, loading } = useSite();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (admin && user.role !== "admin")
    return (
      <div className="page container">
        <h1>{copy("此页面需要管理员权限")}</h1>
        <Link className="button" to="/">
          {copy("返回首页")}
        </Link>
      </div>
    );
  return children;
}
export default function App({ children }: { children: React.ReactNode }) {
  const copy = useCopy();
  const { user, logout, settings, siteError, refreshSite, openChat, chatOpen } =
    useSite();
  const [menu, setMenu] = useState(false),
    [error, setError] = useState("");
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" });
    else
      requestAnimationFrame(() =>
        document.querySelector(location.hash)?.scrollIntoView(),
      );
  }, [location.pathname, location.hash]);
  return (
    <MotionConfig reducedMotion="user">
      <VisitTracker/>
      <a href="#main" className="skip-link">
        {copy("跳至主要内容")}
      </a>
      <header className="header">
        <div className="header-inner">
          <Brand />
          <nav
            className={menu ? "nav open" : "nav"}
            aria-label={copy("主导航")}
          >
            <NavLink to="/" end>
              {copy("首页")}
            </NavLink>
            <NavLink to="/services">{copy("定制服务")}</NavLink>
            <NavLink to="/portfolio">{copy("影像作品")}</NavLink>
            <NavLink to="/community">{copy("壹梵社区")}</NavLink>
            <Link to="/#our-story">{copy("关于壹梵")}</Link>
          </nav>
          <div className="header-actions">
            <ThemeSwitcher />
            <LanguageSwitcher />
            {user ? (
              <>
                <Link className="account-link" to="/account">
                  <UserRound size={17} />
                  <span>{user.name}</span>
                </Link>
                {user.role === "admin" && (
                  <Link className="admin-link" to="/admin">
                    {copy("管理后台")}
                  </Link>
                )}
                <button
                  className="icon-button logout"
                  aria-label={copy("退出登录")}
                  onClick={() =>
                    void logout().catch((e) => setError(e.message))
                  }
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <Link className="account-link" to="/login">
                <UserRound size={17} />
                <span>{copy("登录 / 注册")}</span>
              </Link>
            )}
            <Link to="/services" className="button small header-book">
              {copy("预约体验")}
              <ArrowUpRight size={15} />
            </Link>
            <button
              className="icon-button menu-toggle"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              aria-label={menu ? copy("关闭导航") : copy("打开导航")}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {(siteError || error) && (
        <div className="site-error" role="alert">
          {copy(siteError || error)}{" "}
          <button
            onClick={() => {
              setError("");
              void refreshSite();
            }}
          >
            {copy("重新连接")}
          </button>
        </div>
      )}
      <main id="main">{children}</main>
      <footer className="footer">
        <div className="container footer-main">
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
            <button className="text-button" onClick={() => openChat()}>
              {copy("在线咨询")}
              <ArrowUpRight size={14} />
            </button>
            <p>
              {settings?.site.phone || copy("预约咨询后，为你安排专属沟通")}
            </p>
            {settings?.site.wechat && (
              <p>{copy("微信咨询：{v0}", { v0: settings.site.wechat })}</p>
            )}
            <p>{settings?.site.address || copy("到店信息请向客服咨询")}</p>
            <p>
              {copy("服务时间")} {settings?.site.hours || "10:00 — 20:00"}
            </p>
          </div>
          <div className="footer-note">
            <span className="serif">
              {copy("A moment.")}
              <br />
              <i>{copy("A lifetime.")}</i>
            </span>
            <span>{copy("美，始于你本来的样子。")}</span>
          </div>
        </div>
        <div className="container footer-bottom">
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
        className={`chat-launcher ${chatOpen ? "hidden" : ""}`}
        onClick={() => openChat()}
        aria-label={copy("打开专属客服")}
      >
        <MessageCircle size={21} strokeWidth={1.5} />
        <span>{copy("专属顾问")}</span>
      </button>
      {chatOpen && <Chat />}
    </MotionConfig>
  );
}
