"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { getPathname } from "../i18n/navigation";
import { useCopy, localizeService } from "./i18n";
import {useTheme} from "./ThemeProvider";
import type {ThemeId} from "./themes";
import {useMedia,type ImageMap} from './MediaProvider';

export type User = {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
};
export type Service = {
  id: string;
  title: string;
  english: string;
  category: string;
  description: string;
  price: number;
  deposit: number;
  duration: string;
  features: string[];
  image: string;
  active: boolean;
  featured: boolean;
  sort_order: number;
};
export type Booking = {
  id: string;
  user_id: string;
  service_id: string;
  service_title: string;
  price: number;
  deposit: number;
  day: string;
  time: string;
  status: string;
  contact_name: string;
  phone: string;
  note: string;
  created_at: number;
  expires_at: number;
  conversation_id: string;
  payment_id?: string;
  customer_name?: string;
  staff_viewed_at: number | null;
};
export type Thread = {
  id: string;
  user_id: string;
  booking_id: string | null;
  customer_name: string;
  service_title: string | null;
  service_id?: string;
  day: string | null;
  last_message: string | null;
};
export type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: number;
  staff_read_at: number | null;
};
export type Post = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  author: string;
  like_count: number;
  comment_count: number;
  created_at: number;
  hidden?: number;
  images: string[];
};
export type BookingConfig = {
  enabled: boolean;
  times: string[];
  capacity: number;
  minAdvanceDays: number;
  maxAdvanceDays: number;
  closedWeekdays: number[];
  blockedDates: string[];
};
export type SiteConfig = {
  phone: string;
  address: string;
  hours: string;
  wechat: string;
  samplePricing: boolean;
  defaultTheme?: ThemeId;
};
export type Settings = {
  media: {images:ImageMap};
  site: SiteConfig;
  booking: BookingConfig;
  payment: { available: boolean; methods: string[] };
  retentionDays: number;
};
let csrf = "";
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(typeof document !== "undefined"
        ? { "Accept-Language": document.documentElement.lang }
        : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({ error: "响应异常，请稍后重试" }));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data as T;
}
export const send = <T,>(path: string, body: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(body) });
export const chinaDate = (offset = 0) =>
  new Date(Date.now() + 8 * 3600000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
export const statusNames: Record<string, string> = {
  pending: "待付订金",
  paid: "待确认",
  confirmed: "预约已确认",
  completed: "已完成",
  cancelled: "已取消",
  expired: "已过期",
  refund_review: "到账待核对",
};
export const categories = [
  "婚纱灵感",
  "拍摄日记",
  "生日派对",
  "Cosplay",
  "交流问答",
];

type Context = {
  user: User | null;
  loading: boolean;
  services: Service[];
  settings: Settings | null;
  siteError: string;
  refreshSite: () => Promise<void>;
  authenticate: (mode: string, body: unknown) => Promise<User>;
  logout: () => Promise<void>;
  openChat: (id?: string) => void;
  chatThread?: string;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  live: boolean;
  revision: number;
};
const SiteContext = createContext<Context>(null!);
export const useSite = () => useContext(SiteContext);
export function SiteProvider({ children }: { children: ReactNode }) {
  const {setSiteTheme} = useTheme();
  const {setImages} = useMedia();
  const copy = useCopy(),
    locale = useLocale();
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]),
    [settings, setSettings] = useState<Settings | null>(null),
    [siteError, setSiteError] = useState("");
  const [chatOpen, setChatOpen] = useState(false),
    [chatThread, setChatThread] = useState<string>(),
    [live, setLive] = useState(false),
    [revision, setRevision] = useState(0);
  const refreshSite = useCallback(async () => {
    try {
      const [s, config] = await Promise.all([
        api<Service[]>("/services"),
        api<Settings>("/settings"),
      ]);
      setServices(s);
      setSettings(config);
      setSiteTheme(config.site.defaultTheme);
      setImages(config.media?.images || {});
      setSiteError("");
    } catch (e) {
      setSiteError((e as Error).message);
    }
  }, [setSiteTheme,setImages]);
  useEffect(() => {
    api<{ installed: boolean }>("/install/status")
      .then(async (status) => {
        if (!status.installed) {
          window.location.replace(getPathname({ href: "/install", locale }));
          return;
        }
        await refreshSite();
        return api<{ user: User | null; csrf: string | null }>("/auth/me").then(
          (data) => {
            csrf = data.csrf || "";
            setUser(data.user);
          },
        );
      })
      .finally(() => setLoading(false))
      .catch(() =>
        setSiteError(copy("暂时无法连接服务，请检查 API 服务后刷新")),
      );
  }, [refreshSite, locale, copy]);
  useEffect(() => {
    if (!user) {
      setLive(false);
      return;
    }
    const events = new EventSource("/api/events");
    events.addEventListener("connected", () => {
      setLive(true);
      setRevision((v) => v + 1);
    });
    events.addEventListener("update", (event) => {
      try {
        window.dispatchEvent(new CustomEvent("yifan-update", {detail: JSON.parse((event as MessageEvent).data)}));
      } catch { /* Re-fetch canonical state if an event payload is unavailable. */ }
      setRevision((v) => v + 1);
    });
    events.addEventListener("logout", () => {
      csrf = "";
      setUser(null);
      events.close();
    });
    events.onerror = () => setLive(false);
    return () => events.close();
  }, [user?.id]);
  async function authenticate(mode: string, body: unknown) {
    const data = await send<{ user: User; csrf: string }>(
      `/auth/${mode}`,
      body,
    );
    csrf = data.csrf;
    setUser(data.user);
    return data.user;
  }
  async function logout() {
    await send("/auth/logout", {});
    csrf = "";
    setUser(null);
    setChatOpen(false);
  }
  function openChat(threadId?: string) {
    setChatThread(threadId);
    setChatOpen(true);
  }
  const localizedServices = useMemo(
    () => services.map((s) => localizeService(s, copy)),
    [services, copy],
  );
  return (
    <SiteContext.Provider
      value={{
        user,
        loading,
        services: localizedServices,
        settings,
        siteError,
        refreshSite,
        authenticate,
        logout,
        openChat,
        chatThread,
        chatOpen,
        setChatOpen,
        live,
        revision,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    if (!path) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    api<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, loading, reload };
}
