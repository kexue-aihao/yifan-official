import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  EyeOff,
  Globe,
  Images,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Plus,
  Settings2,
  Search,
  UserRound,
  Users,
} from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onMounted,
  shallowRef,
  ref as vueRef,
  watch,
} from "vue";
import { SiteImage } from "../MediaProvider";
import { ThemeChoices } from "../ThemeSwitcher";
import { Empty, ErrorNotice, Loading, Modal } from "../components";
import {
  countMessages,
  localizeService,
  useCopy,
  useFormatting,
  useServiceTitle,
} from "../i18n";
import {
  send,
  statusNames,
  useResource,
  useSite,
  type Booking,
  type BookingConfig,
  type CustomerUser,
  type Post,
  type Service,
  type SiteConfig,
  type StaffMember,
  type Thread,
} from "../lib";
import { defaultTheme, isTheme, type ThemeId } from "../themes";
import { useVisibleReceipt } from "../useVisibleReceipt";
import { ConversationView } from "./Chat";
import MediaSettings from "./MediaSettings";
import { PostSourceDetails } from "./PostSources";
import Visitors, { AccessHistory } from "./Visitors";
type AdminSettings = {
  site: SiteConfig;
  booking: BookingConfig;
  epay: {
    enabled: boolean;
    gateway: string;
    pid: string;
    secret: string;
    hasSecret: boolean;
    methods: string[];
  };
};
const tabs = [
  { id: "overview", label: "经营概览", icon: BarChart3 },
  { id: "bookings", label: "预约管理", icon: CalendarDays },
  { id: "services", label: "定制服务", icon: Images },
  { id: "media", label: "站点图片", icon: Images },
  { id: "schedule", label: "档期设置", icon: Clock3 },
  { id: "inbox", label: "客服收件箱", icon: MessageCircle },
  { id: "team", label: "店铺成员", icon: Users },
  { id: "users", label: "注册用户", icon: UserRound },
  { id: "visitors", label: "访问与 IP", icon: Globe },
  { id: "posts", label: "社区管理", icon: MessagesSquare },
  { id: "settings", label: "品牌与支付", icon: Settings2 },
];
const blankService: Service = {
  id: "",
  title: "",
  english: "",
  category: "",
  description: "",
  price: 99900,
  deposit: 19900,
  duration: "约 2 小时",
  features: ["专属风格沟通"],
  image: "/images/wedding.jpg",
  active: true,
  featured: false,
  sort_order: 6,
};
const Admin = defineComponent(
  () => {
    const { money, dateTime, date, number } = useFormatting();
    const serviceTitle = useServiceTitle();
    const copy = useCopy();
    const site = useSite();
    const tab = vueRef("overview");
    const visibleTabs = computed(() =>
      site.user?.staffRole === "owner"
        ? tabs
        : tabs.filter((item) => ["overview", "bookings", "inbox"].includes(item.id)),
    );
    const overview = useResource<{
      customers: number;
      bookings: number;
      awaiting: number;
      revenue: number;
    }>(() => (tab.value === "overview" ? "/admin/overview" : null));
    const bookings = useResource<Booking[]>(() =>
      tab.value === "bookings" ? "/admin/bookings" : null,
    );
    const services = useResource<Service[]>(() =>
      tab.value === "services" ? "/admin/services" : null,
    );
    const settings = useResource<AdminSettings>(() =>
      ["settings", "schedule"].includes(tab.value) ? "/admin/settings" : null,
    );
    const threads = useResource<Thread[]>(() =>
      tab.value === "inbox" ? "/conversations" : null,
    );
    const staff = useResource<StaffMember[]>(() =>
      ["inbox", "team"].includes(tab.value) ? "/admin/staff" : null,
    );
    const customerSearch = vueRef("");
    const customerQuery = vueRef("");
    const customerStatus = vueRef("all");
    const customers = useResource<CustomerUser[]>(() =>
      tab.value === "users"
        ? `/admin/users?search=${encodeURIComponent(customerQuery.value)}&status=${customerStatus.value}`
        : null,
    );
    const posts = useResource<Post[]>(() =>
      tab.value === "posts" ? "/admin/posts" : null,
    );
    const edit = vueRef<Service | null>(null);
    const viewedBooking = vueRef<Booking | null>(null);
    const threadId = vueRef("");
    const addingStaff = vueRef(false);
    const notice = vueRef("");
    const error = vueRef("");
    const busy = vueRef(false);
    const bookingFilter = vueRef("all");
    onMounted(() => {
      watch(
        () => [site.revision, overview.reload, bookings.reload, threads.reload, staff.reload, customers.reload],
        () => {
          overview.reload();
          bookings.reload();
          threads.reload();
          staff.reload();
          customers.reload();
        },
        { immediate: true, flush: "post" },
      );
    });
    onMounted(() => {
      watch(
        () => [tab.value],
        () => {
          error.value = "";
          notice.value = "";
        },
        { immediate: true, flush: "post" },
      );
    });
    async function action(
      fn: () => Promise<unknown>,
      success = copy("已保存"),
    ) {
      busy.value = true;
      error.value = "";
      notice.value = "";
      try {
        await fn();
        notice.value = success;
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    async function saveConfig(key: string, value: unknown) {
      await send(`/admin/settings/${key}`, value, "PUT");
      settings.reload();
      await site.refreshSite();
    }
    const currentThread = computed(
      () => threadId.value || threads.data?.[0]?.id,
    );
    const selectedThread = computed(() =>
      threads.data?.find((t) => t.id === currentThread.value),
    );
    async function createStaff(e: SubmitEvent) {
      e.preventDefault();
      const form = new FormData(e.currentTarget as HTMLFormElement);
      await action(async () => {
        await send("/admin/staff", {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          title: form.get("title"),
          sortOrder: Number(form.get("sortOrder") || 0),
        });
        addingStaff.value = false;
        staff.reload();
      }, copy("店铺成员已添加"));
    }
    return () => (
      <div class="admin-shell container">
        <aside class="admin-sidebar">
          <span class="eyebrow">{copy("YI FAN MANAGEMENT")}</span>
          <h1>{copy("品牌工作台")}</h1>
          <p>{copy("{v0}，欢迎回来。", { v0: site.user?.name })}</p>
          <nav aria-label={copy("后台导航")}>
            {visibleTabs.value.map((t) => (
              <button
                key={t.id}
                class={tab.value === t.id ? "active" : ""}
                onClick={() => (tab.value = t.id)}
              >
                <t.icon size={18} strokeWidth={1.4} />
                {copy(t.label)}
              </button>
            ))}
          </nav>
          <div class="admin-side-note">
            {copy("把每一个细节，")}
            <br />
            {copy("都留给美好的体验。")}
          </div>
        </aside>
        <section class="admin-content">
          <div class="admin-title">
            <h2>{copy(visibleTabs.value.find((t) => t.id === tab.value)?.label || "")}</h2>
            <span>{copy("壹梵定制 · 品牌管理")}</span>
          </div>
          {notice.value && (
            <p class="success-notice" role="status">
              <Check size={17} />
              {notice.value}
            </p>
          )}
          <ErrorNotice
            error={
              error.value ||
              overview.error ||
              bookings.error ||
              services.error ||
              settings.error ||
              threads.error ||
              staff.error ||
              customers.error ||
              posts.error
            }
          />
          {tab.value === "overview" &&
            (overview.data ? (
              <>
                <div class="stats-grid">
                  {[
                    {
                      label: copy("注册顾客"),
                      value: overview.data.customers,
                    },
                    {
                      label: copy("累计预约"),
                      value: overview.data.bookings,
                    },
                    {
                      label: copy("待确认预约"),
                      value: overview.data.awaiting,
                    },
                    {
                      label: copy("累计到账订金"),
                      value: `${money(overview.data.revenue)}`,
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <span>{copy(s.label)}</span>
                      <strong>
                        {typeof s.value === "number"
                          ? number(s.value)
                          : s.value}
                      </strong>
                    </div>
                  ))}
                </div>
                <div class="admin-welcome">
                  <span class="eyebrow">
                    {copy("CARE MAKES THE DIFFERENCE")}
                  </span>
                  <h3>{copy("用心服务，从这里开始。")}</h3>
                  <p>
                    {copy(
                      "先完善正式套餐与营业档期，再配置品牌联系方式和支付渠道。客服收件箱会接收顾客的新消息。",
                    )}
                  </p>
                  <div class="admin-quick">
                    <button
                      class="button outline"
                      onClick={() => (tab.value = "bookings")}
                    >
                      {copy("处理预约")}
                    </button>
                    <button
                      class="button"
                      onClick={() => (tab.value = "inbox")}
                    >
                      {copy("接待顾客")}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Loading />
            ))}
          {tab.value === "bookings" && (
            <>
              <div class="admin-toolbar">
                <label>
                  {copy("订单状态")}
                  <select
                    value={bookingFilter.value}
                    onChange={(e) =>
                      (bookingFilter.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  >
                    <option value="all">{copy("全部订单")}</option>
                    {Object.entries(statusNames).map(([k, v]) => (
                      <option key={k} value={k}>
                        {copy(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <button class="text-button" onClick={bookings.reload}>
                  {copy("刷新订单")}
                </button>
              </div>
              {bookings.loading && !bookings.data ? (
                <Loading />
              ) : !bookings.data?.length ? (
                <Empty title={copy("还没有预约订单。")} />
              ) : (
                <div class="admin-order-list">
                  {bookings.data
                    .filter(
                      (b) =>
                        bookingFilter.value === "all" ||
                        bookingFilter.value === b.status,
                    )
                    .map((b) => (
                      <article class="admin-order" key={b.id}>
                        <div>
                          <span class={`status ${b.status}`}>
                            {copy(statusNames[b.status])}
                          </span>
                          <span class="order-id">
                            {b.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <h3>{serviceTitle(b.service_id, b.service_title)}</h3>
                        <div class="admin-order-details">
                          <span>
                            {date(b.day)} · {b.time}
                          </span>
                          <span>
                            {b.contact_name} · {b.phone}
                          </span>
                          <span>
                            {copy("订金 ¥{v0} / 总价 ¥{v1}", {
                              v0: money(b.deposit),
                              v1: money(b.price),
                            })}
                          </span>
                        </div>
                        {b.note && <p class="booking-note">{b.note}</p>}
                        {b.status === "refund_review" && (
                          <p class="error-notice">
                            {copy(
                              "过期后到账：请联系顾客核对档期或在支付平台完成退款，勿直接确认名额。",
                            )}
                          </p>
                        )}
                        <div class="admin-order-actions">
                          <button
                            class="text-button"
                            onClick={() => (viewedBooking.value = b)}
                          >
                            <Eye size={15} /> {copy("查看预约详情")}
                          </button>
                          <span class="booking-read-status">
                            {b.staff_viewed_at
                              ? copy("工作人员已查看")
                              : copy("待工作人员查看")}
                          </span>
                          <button
                            class="text-button"
                            onClick={() => {
                              threadId.value = b.conversation_id;
                              tab.value = "inbox";
                            }}
                          >
                            {copy("联系顾客")}
                          </button>
                          {b.status === "paid" && (
                            <button
                              disabled={busy.value}
                              class="button small"
                              onClick={() =>
                                void action(async () => {
                                  await send(
                                    `/admin/bookings/${b.id}`,
                                    { status: "confirmed" },
                                    "PATCH",
                                  );
                                  bookings.reload();
                                }, copy("预约已确认"))
                              }
                            >
                              {copy("确认档期")}
                            </button>
                          )}
                          {b.status === "confirmed" && (
                            <button
                              disabled={busy.value}
                              class="button outline small"
                              onClick={() =>
                                void action(async () => {
                                  await send(
                                    `/admin/bookings/${b.id}`,
                                    { status: "completed" },
                                    "PATCH",
                                  );
                                  bookings.reload();
                                }, copy("服务已完成"))
                              }
                            >
                              {copy("标记已完成")}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </>
          )}
          {tab.value === "services" && (
            <>
              <div class="admin-toolbar">
                <p>{copy("价格与订金均以人民币计。停用后不影响已有订单。")}</p>
                <button
                  class="button small"
                  onClick={() => (edit.value = blankService)}
                >
                  <Plus size={16} />
                  {copy("新增服务")}
                </button>
              </div>
              {services.loading ? (
                <Loading />
              ) : (
                <div class="admin-services">
                  {services.data?.map((s) => (
                    <article key={s.id}>
                      <SiteImage src={s.image} alt="" />
                      <div>
                        <h3>
                          {serviceTitle(s.id, s.title)}
                          <span
                            class={`status ${s.active ? "confirmed" : "expired"}`}
                          >
                            {s.active ? copy("已上架") : copy("已停用")}
                          </span>
                        </h3>
                        <p>
                          {copy("套餐 ¥{v0} · 订金 ¥{v1}", {
                            v0: money(s.price),
                            v1: money(s.deposit),
                          })}
                        </p>
                        <span class="subtle-note">
                          {localizeService(s, copy).duration} ·{" "}
                          {copy(s.category)}
                        </span>
                      </div>
                      <button
                        class="icon-button"
                        aria-label={copy("编辑{v0}", { v0: s.title })}
                        onClick={() => (edit.value = s)}
                      >
                        <Pencil size={18} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {tab.value === "schedule" &&
            (settings.data ? (
              <ScheduleForm
                key={JSON.stringify(settings.data.booking)}
                config={settings.data.booking}
                busy={busy.value}
                onSave={(value) =>
                  void action(
                    () => saveConfig("booking", value),
                    copy("预约档期已更新"),
                  )
                }
              />
            ) : (
              <Loading />
            ))}
          {tab.value === "settings" &&
            (settings.data ? (
              <div class="settings-sections">
                <AppearanceForm
                  config={settings.data.site}
                  busy={busy.value}
                  onSave={(value) =>
                    void action(
                      () => saveConfig("site", value),
                      copy("品牌主题已更新"),
                    )
                  }
                />
                <SiteForm
                  config={settings.data.site}
                  busy={busy.value}
                  onSave={(value) =>
                    void action(
                      () => saveConfig("site", value),
                      copy("品牌资料已更新"),
                    )
                  }
                />
                <EpayForm
                  config={settings.data.epay}
                  busy={busy.value}
                  onSave={(value) =>
                    void action(
                      () => saveConfig("epay", value),
                      copy("支付设置已保存"),
                    )
                  }
                />
              </div>
            ) : (
              <Loading />
            ))}
          {tab.value === "inbox" && (
            <div class="admin-inbox">
              <div class="inbox-threads">
                {threads.loading && !threads.data ? (
                  <Loading />
                ) : !threads.data?.length ? (
                  <p class="form-note">
                    {copy("顾客发起咨询后，会话会出现在这里。")}
                  </p>
                ) : (
                  threads.data.map((t) => (
                    <button
                      class={currentThread.value === t.id ? "active" : ""}
                      onClick={() => (threadId.value = t.id)}
                      key={t.id}
                    >
                      <strong>{t.customer_name}</strong>
                      <span>
                        {t.assignee_name
                          ? `${copy("接待")}：${t.assignee_name}${t.assignee_title ? ` · ${t.assignee_title}` : ""} · `
                          : `${copy("未分配")} · `}
                        {t.service_title
                          ? serviceTitle(t.service_id || "", t.service_title)
                          : copy("专属顾问咨询")}
                        {t.day ? ` · ${t.day}` : ""}
                      </span>
                      <p>{t.last_message || copy("暂无消息")}</p>
                    </button>
                  ))
                )}
              </div>
              <div class="inbox-conversation">
                {currentThread.value ? (
                  <>
                    <details class="conversation-access">
                      <summary>{copy("用户与访问记录")}</summary>
                      <p>
                        {copy("注册 ID")}：
                        <code>
                          {
                            threads.data?.find(
                              (t) => t.id === currentThread.value,
                            )?.user_id
                          }
                        </code>
                      </p>
                      <AccessHistory
                        key={currentThread.value}
                        query={`conversationId=${currentThread.value}`}
                      />
                    </details>
                    {selectedThread.value && (
                      <div class="inbox-assignment">
                        <label>
                          {copy("会话负责人")}
                          <select
                            value={selectedThread.value.assignee_id || ""}
                            onChange={(e) =>
                              void action(async () => {
                                const assigneeId = (e.target as HTMLSelectElement).value || null;
                                await send(
                                  `/conversations/${currentThread.value}/assignee`,
                                  { assigneeId },
                                  "PATCH",
                                );
                                threads.reload();
                              }, copy("会话负责人已更新"))
                            }
                          >
                            <option value="">{copy("未分配")}</option>
                            {staff.data?.filter((member) => member.active).map((member) => (
                              <option value={member.id} key={member.id}>
                                {member.display_name} · {member.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          class="text-button"
                          disabled={busy.value || selectedThread.value.assignee_id === site.user?.id}
                          onClick={() =>
                            void action(async () => {
                              await send(
                                `/conversations/${currentThread.value}/assignee`,
                                { assigneeId: site.user?.id },
                                "PATCH",
                              );
                              threads.reload();
                            }, copy("已由你接待"))
                          }
                        >
                          {copy("我来接待")}
                        </button>
                      </div>
                    )}
                    <ConversationView
                      key={currentThread.value}
                      threadId={currentThread.value}
                      thread={selectedThread.value}
                    />
                  </>
                ) : (
                  <Empty title={copy("在这里，认真回应每一份期待。")} />
                )}
              </div>
            </div>
          )}
          {tab.value === "team" && (
            <section class="team-management">
              <div class="admin-toolbar">
                <p>{copy("每位店铺成员使用独立账号，客户会看到成员姓名与岗位。")}</p>
                <button class="button small" onClick={() => (addingStaff.value = !addingStaff.value)}>
                  <Plus size={16} /> {copy(addingStaff.value ? "取消添加" : "添加成员")}
                </button>
              </div>
              {addingStaff.value && (
                <form class="form team-create" onSubmit={createStaff}>
                  <div class="form-row">
                    <label>{copy("姓名")}<input name="name" maxlength={30} required /></label>
                    <label>{copy("岗位")}<input name="title" maxlength={40} placeholder={copy("摄影师、化妆师、客服") } required /></label>
                  </div>
                  <div class="form-row">
                    <label>{copy("登录邮箱")}<input name="email" type="email" maxlength={160} required /></label>
                    <label>{copy("初始密码")}<input name="password" type="password" minlength={10} maxlength={128} required /></label>
                  </div>
                  <label>{copy("排序")}<input name="sortOrder" type="number" min="0" max="100" value="0" /></label>
                  <button class="button" disabled={busy.value}>{copy("创建成员账号")}</button>
                </form>
              )}
              {staff.loading && !staff.data ? <Loading /> : !staff.data?.length ? (
                <Empty title={copy("还没有店铺成员。")} />
              ) : (
                <div class="team-list">
                  {staff.data.map((member) => (
                    <form
                      class="team-member"
                      key={member.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget as HTMLFormElement);
                        void action(async () => {
                          await send(`/admin/staff/${member.id}`, {
                            displayName: form.get("displayName"),
                            title: form.get("title"),
                            active:
                              member.id === site.user?.id ||
                              form.get("active") === "on",
                            sortOrder: Number(form.get("sortOrder")),
                          }, "PATCH");
                          staff.reload();
                        }, copy("成员资料已保存"));
                      }}
                    >
                      <div class="team-member-account">
                        <strong>{member.display_name}</strong>
                        <span>{member.email}</span>
                      </div>
                      <label>{copy("对客姓名")}<input name="displayName" maxlength={30} value={member.display_name} required /></label>
                      <label>{copy("岗位")}<input name="title" maxlength={40} value={member.title} required /></label>
                      <label>{copy("排序")}<input name="sortOrder" type="number" min="0" max="100" value={member.sort_order} required /></label>
                      <label class="checkbox-label"><input name="active" type="checkbox" checked={!!member.active} disabled={member.id === site.user?.id} />{copy("启用")}</label>
                      <button class="button outline small" disabled={busy.value}>{copy("保存")}</button>
                    </form>
                  ))}
                </div>
              )}
            </section>
          )}
          {tab.value === "users" && (
            <section class="customer-management">
              <form
                class="admin-toolbar customer-toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  customerQuery.value = customerSearch.value.trim();
                }}
              >
                <label class="customer-search">
                  <Search size={16} />
                  <input
                    value={customerSearch.value}
                    onInput={(e) =>
                      (customerSearch.value = (e.target as HTMLInputElement).value)}
                    maxlength={80}
                    placeholder={copy("搜索姓名或邮箱")}
                    aria-label={copy("搜索注册用户")}
                  />
                </label>
                <label>
                  {copy("账号状态")}
                  <select
                    value={customerStatus.value}
                    onChange={(e) =>
                      (customerStatus.value = (e.target as HTMLSelectElement).value)}
                  >
                    <option value="all">{copy("全部用户")}</option>
                    <option value="active">{copy("正常")}</option>
                    <option value="inactive">{copy("已停用")}</option>
                  </select>
                </label>
                <button class="text-button" type="submit">
                  <Search size={15} /> {copy("查询")}
                </button>
              </form>
              {customers.loading && !customers.data ? (
                <Loading />
              ) : !customers.data?.length ? (
                <Empty title={copy("还没有符合条件的注册用户。")} />
              ) : (
                <div class="customer-list">
                  {customers.data.map((customer) => (
                    <form
                      class="customer-user"
                      key={customer.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget as HTMLFormElement);
                        void action(async () => {
                          await send(
                            `/admin/users/${customer.id}`,
                            {
                              name: form.get("name"),
                              active: form.get("active") === "on",
                            },
                            "PATCH",
                          );
                          customers.reload();
                        }, copy("用户资料已保存"));
                      }}
                    >
                      <div class="customer-user-account">
                        <div>
                          <UserRound size={18} strokeWidth={1.4} />
                          <strong>{customer.name}</strong>
                          <span class={`status ${customer.active ? "confirmed" : "expired"}`}>
                            {customer.active ? copy("正常") : copy("已停用")}
                          </span>
                        </div>
                        <span>{customer.email}</span>
                        <small>
                          {copy("注册于 {v0}", { v0: dateTime(customer.created_at) })}
                        </small>
                      </div>
                      <div class="customer-user-stats">
                        <span>{copy("预约 {v0}", { v0: number(customer.booking_count) })}</span>
                        <span>{copy("会话 {v0}", { v0: number(customer.conversation_count) })}</span>
                        <span>
                          {customer.last_activity
                            ? copy("最近活动 {v0}", { v0: dateTime(customer.last_activity) })
                            : copy("暂无活动")}
                        </span>
                      </div>
                      <label>
                        {copy("顾客称呼")}
                        <input name="name" maxlength={30} value={customer.name} required />
                      </label>
                      <label class="checkbox-label customer-user-active">
                        <input name="active" type="checkbox" checked={!!customer.active} />
                        {copy("允许登录")}
                      </label>
                      <button class="button outline small" disabled={busy.value}>
                        {copy("保存")}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </section>
          )}
          {tab.value === "visitors" && <Visitors />}
          {tab.value === "media" && <MediaSettings />}
          {tab.value === "posts" && (
            <>
              <PostSourceDetails />
              {posts.loading ? (
                <Loading />
              ) : !posts.data?.length ? (
                <Empty title={copy("还没有社区故事。")} />
              ) : (
                <div class="admin-posts">
                  {posts.data.map((p) => (
                    <article key={p.id}>
                      <div>
                        <span class="tag">{copy(p.category)}</span>
                        <span
                          class={`status ${p.hidden ? "expired" : "confirmed"}`}
                        >
                          {p.hidden ? copy("已隐藏") : copy("公开中")}
                        </span>
                      </div>
                      <h3>{p.title}</h3>
                      <p class="post-excerpt">{p.body.slice(0, 250)}</p>
                      <p class="subtle-note">
                        {p.author} · {dateTime(p.created_at)} ·{" "}
                        {copy(countMessages.replies, {
                          count: p.comment_count,
                        })}
                      </p>
                      <p class="post-author-id">
                        {copy("注册 ID")} <bdi>{p.user_id}</bdi>
                      </p>
                      <PostSourceDetails postId={p.id} label="查看发布来源" />
                      <button
                        class="button outline small"
                        disabled={busy.value}
                        onClick={() =>
                          void action(
                            async () => {
                              await send(
                                `/admin/posts/${p.id}`,
                                { hidden: !p.hidden },
                                "PATCH",
                              );
                              posts.reload();
                            },
                            p.hidden ? copy("帖子已恢复") : copy("帖子已隐藏"),
                          )
                        }
                      >
                        {p.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                        {p.hidden ? copy("恢复展示") : copy("隐藏帖子")}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {viewedBooking.value && (
            <BookingDetails
              booking={viewedBooking.value}
              onClose={() => (viewedBooking.value = null)}
              onViewed={() => bookings.reload()}
            />
          )}
          {edit.value && (
            <ServiceForm
              service={edit.value}
              onClose={() => (edit.value = null)}
              onSaved={() => {
                edit.value = null;
                services.reload();
                void site.refreshSite();
                notice.value = copy("服务已保存");
              }}
            />
          )}
        </section>
      </div>
    );
  },
  { name: "Admin", props: [] },
);
export default Admin;
const BookingDetails = defineComponent(
  (props: { booking: Booking; onClose: () => void; onViewed: () => void }) => {
    const copy = useCopy();
    const { date, money } = useFormatting();
    const serviceTitle = useServiceTitle();
    const ref = shallowRef<HTMLDivElement | null>(null);
    const pending = shallowRef(false);
    const viewed = vueRef(!!props.booking.staff_viewed_at);
    const error = vueRef("");
    const acknowledge = () => {
      if (pending.value) return;
      pending.value = true;
      void send(`/admin/bookings/${props.booking.id}/view`, {})
        .then(() => {
          viewed.value = true;
          props.onViewed();
        })
        .catch((e) => {
          error.value = e.message;
          pending.value = false;
        });
    };
    useVisibleReceipt(ref, () => !viewed.value, acknowledge);
    return () => (
      <Modal title={copy("预约详情")} onClose={props.onClose}>
        <div ref={ref} class="booking-details">
          <h3 data-receipt-id={props.booking.id}>
            {serviceTitle(
              props.booking.service_id,
              props.booking.service_title,
            )}
          </h3>
          <p>
            {date(props.booking.day)} · {props.booking.time}
          </p>
          <p>
            {props.booking.contact_name} · {props.booking.phone}
          </p>
          <p>
            {money(props.booking.deposit)} / {money(props.booking.price)}
          </p>
          {props.booking.note && (
            <p class="booking-note">{props.booking.note}</p>
          )}
          <p class="booking-read-status">
            {viewed.value ? copy("工作人员已查看") : copy("待工作人员查看")}
          </p>
          <p>
            {copy("注册 ID")}：<code>{props.booking.user_id}</code>
          </p>
          <details>
            <summary>{copy("用户与访问记录")}</summary>
            <AccessHistory query={`bookingId=${props.booking.id}`} />
          </details>
          <ErrorNotice error={error.value} />
        </div>
      </Modal>
    );
  },
  { name: "BookingDetails", props: ["booking", "onClose", "onViewed"] },
);
const ServiceForm = defineComponent(
  (props: { service: Service; onClose: () => void; onSaved: () => void }) => {
    const copy = useCopy();
    const busy = vueRef(false);
    const error = vueRef("");
    async function submit(e: SubmitEvent) {
      e.preventDefault();
      const d = new FormData(e.currentTarget as HTMLFormElement);
      busy.value = true;
      error.value = "";
      const value = {
        title: d.get("title"),
        english: d.get("english"),
        category: d.get("category"),
        description: d.get("description"),
        price: Math.round(Number(d.get("price")) * 100),
        deposit: Math.round(Number(d.get("deposit")) * 100),
        duration: d.get("duration"),
        features: String(d.get("features"))
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        image: d.get("image"),
        active: d.get("active") === "on",
        featured: d.get("featured") === "on",
        sort_order: Number(d.get("sort_order")),
      };
      try {
        await send(
          `/admin/services${props.service.id ? `/${props.service.id}` : ""}`,
          value,
          props.service.id ? "PUT" : "POST",
        );
        props.onSaved();
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    return () => (
      <Modal
        title={
          props.service.id
            ? copy("编辑 · {v0}", { v0: props.service.title })
            : copy("新增定制服务")
        }
        onClose={props.onClose}
      >
        <form class="form" onSubmit={submit}>
          <div class="form-row">
            <label>
              {copy("服务名称")}
              <input
                name="title"
                value={props.service.title}
                maxlength={60}
                required
              />
            </label>
            <label>
              {copy("服务分类")}
              <input
                name="category"
                value={props.service.category}
                maxlength={30}
                required
              />
            </label>
          </div>
          <label>
            {copy("英文副标题")}
            <input
              name="english"
              value={props.service.english}
              maxlength={80}
              required
            />
          </label>
          <label>
            {copy("服务介绍")}
            <textarea
              name="description"
              value={props.service.description}
              maxlength={1000}
              rows={3}
              required
            />
          </label>
          <div class="form-row">
            <label>
              {copy("套餐价格（元）")}
              <input
                name="price"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={props.service.price / 100}
                required
              />
            </label>
            <label>
              {copy("预约订金（元）")}
              <input
                name="deposit"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={props.service.deposit / 100}
                required
              />
            </label>
          </div>
          <div class="form-row">
            <label>
              {copy("服务时长")}
              <input
                name="duration"
                value={props.service.duration}
                maxlength={60}
                required
              />
            </label>
            <label>
              {copy("展示顺序")}
              <input
                name="sort_order"
                type="number"
                min="0"
                max="100"
                value={props.service.sort_order}
                required
              />
            </label>
          </div>
          <label>
            {copy("套餐内容（每行一项，最多 10 项）")}
            <textarea
              name="features"
              value={props.service.features.join("\n")}
              rows={4}
              required
            />
          </label>
          <label>
            {copy("展示配图")}
            <input
              name="image"
              list="service-image-options"
              value={props.service.image}
              maxlength={2048}
              required
            />
            <datalist id="service-image-options">
              {[
                "wedding",
                "celebration",
                "portrait",
                "dress",
                "beauty",
                "cosplay",
              ].map((name, i) => (
                <option value={`/images/${name}.jpg`} key={name}>
                  {copy(
                    [
                      "婚纱影像",
                      "庆典布置",
                      "个人写真",
                      "礼服",
                      "化妆造型",
                      "角色写真",
                    ][i],
                  )}
                </option>
              ))}
            </datalist>
          </label>
          <p class="subtle-note">
            {copy(
              "选择默认配图，或粘贴 HTTPS 图片直链。默认配图跟随站点图片设置。",
            )}
          </p>
          <div class="form-row">
            <label class="checkbox-label">
              <input
                type="checkbox"
                name="active"
                checked={props.service.active}
              />
              {copy("上架该服务")}
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                name="featured"
                checked={props.service.featured}
              />
              {copy("标记壹梵精选")}
            </label>
          </div>
          <ErrorNotice error={error.value} />
          <button class="button full" disabled={busy.value}>
            {busy.value ? copy("保存中…") : copy("保存服务")}
          </button>
        </form>
      </Modal>
    );
  },
  { name: "ServiceForm", props: ["service", "onClose", "onSaved"] },
);
const ScheduleForm = defineComponent(
  (props: {
    config: BookingConfig;
    busy: boolean;
    onSave: (v: BookingConfig) => void;
  }) => {
    const copy = useCopy();
    const { weekday } = useFormatting();
    function submit(e: SubmitEvent) {
      e.preventDefault();
      const d = new FormData(e.currentTarget as HTMLFormElement);
      props.onSave({
        enabled: d.get("enabled") === "on",
        times: String(d.get("times"))
          .split(/[,，\s]+/)
          .filter(Boolean),
        capacity: Number(d.get("capacity")),
        minAdvanceDays: Number(d.get("min")),
        maxAdvanceDays: Number(d.get("max")),
        closedWeekdays: d.getAll("closed").map(Number),
        blockedDates: String(d.get("blocked"))
          .split(/[,，\s]+/)
          .filter(Boolean),
      });
    }
    return () => (
      <form class="form settings-form" onSubmit={submit}>
        <h3>{copy("预约档期")}</h3>
        <p class="subtle-note">
          {copy("容量为全店每时段可承接的预约数。时间均为北京时间。")}
        </p>
        <label class="checkbox-label">
          <input
            name="enabled"
            type="checkbox"
            checked={props.config.enabled}
          />
          {copy("开放在线预约")}
        </label>
        <label>
          {copy("每日可预约时段（以逗号分隔）")}
          <input
            name="times"
            value={props.config.times.join(", ")}
            placeholder="10:00, 13:00, 15:00, 17:00"
            required
          />
        </label>
        <div class="form-row">
          <label>
            {copy("每时段容量")}
            <input
              name="capacity"
              type="number"
              min={1}
              max={50}
              value={props.config.capacity}
              required
            />
          </label>
          <label>
            {copy("最早提前几天")}
            <input
              name="min"
              type="number"
              min={0}
              max={30}
              value={props.config.minAdvanceDays}
              required
            />
          </label>
          <label>
            {copy("最远提前几天")}
            <input
              name="max"
              type="number"
              min={1}
              max={365}
              value={props.config.maxAdvanceDays}
              required
            />
          </label>
        </div>
        <fieldset>
          <legend>{copy("每周休息日")}</legend>
          <div class="weekday-choices">
            {["日", "一", "二", "三", "四", "五", "六"].map((day, i) => (
              <label key={day}>
                <input
                  name="closed"
                  type="checkbox"
                  value={i}
                  checked={props.config.closedWeekdays.includes(i)}
                />
                {weekday(i)}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          {copy("暂停预约日期（以逗号分隔）")}
          <textarea
            name="blocked"
            value={props.config.blockedDates.join(", ")}
            placeholder="2026-12-25, 2027-01-01"
            rows={3}
          />
        </label>
        <p class="info-notice">
          {copy(
            "修改档期只影响新的预约，不会自动取消已创建的订单；请提前与已有预约的顾客沟通。",
          )}
        </p>
        <button class="button" disabled={props.busy}>
          {props.busy ? copy("保存中…") : copy("保存档期设置")}
        </button>
      </form>
    );
  },
  { name: "ScheduleForm", props: ["config", "busy", "onSave"] },
);
const AppearanceForm = defineComponent(
  (props: {
    config: SiteConfig;
    busy: boolean;
    onSave: (value: SiteConfig) => void;
  }) => {
    const copy = useCopy();
    const value = vueRef<ThemeId>(
      isTheme(props.config.defaultTheme)
        ? props.config.defaultTheme
        : defaultTheme,
    );
    onMounted(() => {
      watch(
        () => [props.config.defaultTheme],
        () => {
          value.value = isTheme(props.config.defaultTheme)
            ? props.config.defaultTheme
            : defaultTheme;
        },
        { immediate: true, flush: "post" },
      );
    });
    return () => (
      <form
        class="form settings-form appearance-form"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave({ ...props.config, defaultTheme: value.value });
        }}
      >
        <h3>{copy("品牌主题")}</h3>
        <p class="subtle-note">
          {copy("选择新访客看到的默认主题。访客仍可在页头切换自己喜欢的色调。")}
        </p>
        <ThemeChoices
          value={value.value}
          onChange={(__value) => {
            value.value = __value;
          }}
        />
        <button class="button" disabled={props.busy}>
          {props.busy ? copy("保存中…") : copy("保存品牌主题")}
        </button>
      </form>
    );
  },
  { name: "AppearanceForm", props: ["config", "busy", "onSave"] },
);
const SiteForm = defineComponent(
  (props: {
    config: SiteConfig;
    busy: boolean;
    onSave: (v: SiteConfig) => void;
  }) => {
    const copy = useCopy();
    function submit(e: SubmitEvent) {
      e.preventDefault();
      const d = new FormData(e.currentTarget as HTMLFormElement);
      props.onSave({
        phone: String(d.get("phone")),
        address: String(d.get("address")),
        hours: String(d.get("hours")),
        wechat: String(d.get("wechat")),
        samplePricing: d.get("sample") === "on",
        defaultTheme: props.config.defaultTheme || defaultTheme,
      });
    }
    return () => (
      <form class="form settings-form" onSubmit={submit}>
        <h3>{copy("品牌联系资料")}</h3>
        <div class="form-row">
          <label>
            {copy("联系电话")}
            <input name="phone" value={props.config.phone} maxlength={40} />
          </label>
          <label>
            {copy("微信咨询号")}
            <input name="wechat" value={props.config.wechat} maxlength={80} />
          </label>
        </div>
        <label>
          {copy("门店地址")}
          <input name="address" value={props.config.address} maxlength={200} />
        </label>
        <label>
          {copy("服务时间")}
          <input
            name="hours"
            value={props.config.hours}
            maxlength={100}
            required
          />
        </label>
        <label class="checkbox-label">
          <input
            name="sample"
            type="checkbox"
            checked={props.config.samplePricing}
          />
          {copy("显示“示例套餐与价格”提示（正式定价后可关闭）")}
        </label>
        <button class="button" disabled={props.busy}>
          {copy("保存品牌资料")}
        </button>
      </form>
    );
  },
  { name: "SiteForm", props: ["config", "busy", "onSave"] },
);
const EpayForm = defineComponent(
  (props: {
    config: AdminSettings["epay"];
    busy: boolean;
    onSave: (v: unknown) => void;
  }) => {
    const copy = useCopy();
    function submit(e: SubmitEvent) {
      e.preventDefault();
      const d = new FormData(e.currentTarget as HTMLFormElement);
      props.onSave({
        enabled: d.get("enabled") === "on",
        gateway: String(d.get("gateway")),
        pid: String(d.get("pid")),
        secret: String(d.get("secret")),
        methods: d.getAll("method"),
      });
    }
    return () => (
      <form class="form settings-form" onSubmit={submit}>
        <h3>{copy("易支付 Epay")}</h3>
        <p class="subtle-note">
          {copy(
            "适用于传统 submit.php / MD5 协议。请填写实际支付服务提供方的商户资料。",
          )}
        </p>
        <label class="checkbox-label">
          <input
            type="checkbox"
            name="enabled"
            checked={props.config.enabled}
          />
          {copy("启用在线支付")}
        </label>
        <label>
          {copy("网关根目录（HTTPS）")}
          <input
            type="url"
            name="gateway"
            value={props.config.gateway}
            placeholder="https://pay.example.com/"
            maxlength={300}
          />
        </label>
        <label>
          {copy("商户号 PID")}
          <input
            name="pid"
            value={props.config.pid}
            inputmode="numeric"
            maxlength={40}
          />
        </label>
        <label>
          {copy("商户密钥")}
          <input
            name="secret"
            type="password"
            autocomplete="new-password"
            placeholder={
              props.config.hasSecret
                ? copy("已设置密钥；留空保留原密钥")
                : copy("请输入商户密钥")
            }
            maxlength={200}
          />
        </label>
        <fieldset>
          <legend>{copy("可用支付方式")}</legend>
          <div class="weekday-choices">
            {[
              ["alipay", "支付宝"],
              ["wxpay", "微信支付"],
              ["qqpay", "QQ 钱包"],
            ].map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  name="method"
                  value={key}
                  checked={props.config.methods.includes(key)}
                />
                {copy(label)}
              </label>
            ))}
          </div>
        </fieldset>
        <p class="info-notice">
          {copy(
            "正式收款前需设置本站 HTTPS 域名，并在支付平台确认异步通知可以访问。已发起的支付使用发起时的商户配置核验回调。",
          )}
        </p>
        <button class="button" disabled={props.busy}>
          {copy("保存支付设置")}
        </button>
      </form>
    );
  },
  { name: "EpayForm", props: ["config", "busy", "onSave"] },
);
