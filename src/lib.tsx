import {
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
} from "vue";
import { useRouter } from "vue-router";
import { localizeService, useCopy } from "./i18n";
import { useMedia, type ImageMap } from "./MediaProvider";
import { localizedPath, stripLocale } from "./routing";
import { useTheme } from "./ThemeProvider";
import type { ThemeId } from "./themes";
export type User = {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  staffTitle?: string | null;
  staffRole?: "owner" | "staff" | null;
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
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_title: string | null;
};
export type StaffMember = {
  id: string;
  email: string;
  name: string;
  display_name: string;
  title: string;
  active: number;
  sort_order: number;
};
export type CustomerUser = {
  id: string;
  email: string;
  name: string;
  created_at: number;
  active: number;
  booking_count: number;
  conversation_count: number;
  last_activity: number;
};
export type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_title: string | null;
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
  view_count: number;
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
  media: {
    images: ImageMap;
  };
  site: SiteConfig;
  booking: BookingConfig;
  payment: {
    available: boolean;
    methods: string[];
  };
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
type Site = {
  user: User | null;
  loading: boolean;
  services: Service[];
  settings: Settings | null;
  siteError: string;
  chatOpen: boolean;
  chatThread: string | undefined;
  live: boolean;
  revision: number;
  refreshSite: () => Promise<void>;
  authenticate: (mode: string, body: unknown) => Promise<User>;
  logout: () => Promise<void>;
  openChat: (id?: string) => void;
  setChatOpen: (open: boolean) => void;
};
const key: InjectionKey<Site> = Symbol("site");
export function useSite() {
  return inject(key)!;
}
export function provideSite() {
  const theme = useTheme(),
    media = useMedia(),
    copy = useCopy(),
    router = useRouter();
  const rawServices = ref<Service[]>([]);
  let retryTimer: number | undefined;
  const state = reactive({
    user: null as User | null,
    loading: true,
    get services() {
      return rawServices.value.map((s) => localizeService(s, copy));
    },
    settings: null as Settings | null,
    siteError: "",
    chatOpen: false,
    chatThread: undefined as string | undefined,
    live: false,
    revision: 0,
    async refreshSite() {
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      try {
        const [services, settings] = await Promise.all([
          api<Service[]>("/services"),
          api<Settings>("/settings"),
        ]);
        rawServices.value = services;
        state.settings = settings;
        theme.setSiteTheme(settings.site.defaultTheme);
        media.setImages(settings.media?.images || {});
        state.siteError = "";
      } catch (error) {
        state.siteError = (error as Error).message;
        if (typeof window !== "undefined" && retryTimer === undefined)
          retryTimer = window.setTimeout(() => {
            retryTimer = undefined;
            if (!disposed) void state.refreshSite();
          }, 2000);
      }
    },
    async authenticate(mode: string, body: unknown) {
      const data = await send<{
        user: User;
        csrf: string;
      }>("/auth/" + mode, body);
      csrf = data.csrf;
      state.user = data.user;
      return data.user;
    },
    async logout() {
      await send("/auth/logout", {});
      csrf = "";
      state.user = null;
      state.chatOpen = false;
    },
    openChat(id?: string) {
      state.chatThread = id;
      state.chatOpen = true;
    },
    setChatOpen(open: boolean) {
      state.chatOpen = open;
    },
  }) as Site;
  provide(key, state);
  let events: EventSource | undefined,
    initialized = false,
    disposed = false;
  onMounted(() => {
    watch(
      () => router.currentRoute.value.path,
      async (path) => {
        if (stripLocale(path) === "/install" || initialized) return;
        initialized = true;
        try {
          const status = await api<{
            installed: boolean;
          }>("/install/status");
          if (!status.installed) {
            initialized = false;
            const locale = document.documentElement.lang;
            await router.replace(localizedPath("/install", locale));
            return;
          }
          await state.refreshSite();
          const data = await api<{
            user: User | null;
            csrf: string | null;
          }>("/auth/me");
          if (!disposed) {
            csrf = data.csrf || "";
            state.user = data.user;
          }
        } catch {
          state.siteError = copy("暂时无法连接服务，请检查 API 服务后刷新");
        } finally {
          state.loading = false;
        }
      },
      { immediate: true },
    );
    watch(
      () => state.user?.id,
      (id) => {
        events?.close();
        state.live = false;
        if (!id) return;
        const source = (events = new EventSource("/api/events"));
        source.addEventListener("connected", () => {
          state.live = true;
          state.revision++;
        });
        source.addEventListener("update", (event) => {
          try {
            window.dispatchEvent(
              new CustomEvent("yifan-update", {
                detail: JSON.parse((event as MessageEvent).data),
              }),
            );
          } catch {}
          state.revision++;
        });
        source.addEventListener("logout", () => {
          csrf = "";
          state.user = null;
          source.close();
        });
        source.onerror = () => {
          state.live = false;
        };
      },
      { immediate: true },
    );
  });
  onBeforeUnmount(() => {
    disposed = true;
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    events?.close();
  });
  return state;
}
export function useResource<T>(path: MaybeRefOrGetter<string | null>) {
  const data = ref<T | null>(null),
    error = ref(""),
    loading = ref(true),
    revision = ref(0);
  let generation = 0,
    controller: AbortController | undefined;
  const reload = () => {
    revision.value++;
  };
  onMounted(() =>
    watch(
      () => [toValue(path), revision.value] as const,
      async ([url]) => {
        const current = ++generation;
        controller?.abort();
        controller = new AbortController();
        if (!url) {
          data.value = null;
          error.value = "";
          loading.value = false;
          return;
        }
        loading.value = true;
        error.value = "";
        try {
          const result = await api<T>(url, { signal: controller.signal });
          if (current === generation) data.value = result;
        } catch (reason) {
          if (current === generation && (reason as Error).name !== "AbortError")
            error.value = (reason as Error).message;
        } finally {
          if (current === generation) loading.value = false;
        }
      },
      { immediate: true },
    ),
  );
  onBeforeUnmount(() => {
    generation++;
    controller?.abort();
  });
  return reactive({ data, error, loading, reload });
}
