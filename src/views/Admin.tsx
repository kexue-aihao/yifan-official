"use client";
import {
  useCopy,
  useFormatting,
  useServiceTitle,
  localizeService,
  countMessages,
} from "../i18n";

import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  CalendarDays,
  Images,
  Clock3,
  MessageCircle,
  MessagesSquare,
  Settings2,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import {
  useSite,
  useResource,
  send,
  statusNames,
  type Service,
  type Booking,
  type BookingConfig,
  type SiteConfig,
  type Thread,
  type Post,
} from "../lib";
import { Empty, ErrorNotice, Loading, Modal } from "../components";
import { ConversationView } from "./Chat";

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
  { id: "schedule", label: "档期设置", icon: Clock3 },
  { id: "inbox", label: "客服收件箱", icon: MessageCircle },
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

export default function Admin() {
  const { money, dateTime, date, number } = useFormatting();
  const serviceTitle = useServiceTitle();
  const copy = useCopy();
  const { user, revision, refreshSite } = useSite();
  const [tab, setTab] = useState("overview");
  const overview = useResource<{
    customers: number;
    bookings: number;
    awaiting: number;
    revenue: number;
  }>(tab === "overview" ? "/admin/overview" : null);
  const bookings = useResource<Booking[]>(
    tab === "bookings" ? "/admin/bookings" : null,
  );
  const services = useResource<Service[]>(
    tab === "services" ? "/admin/services" : null,
  );
  const settings = useResource<AdminSettings>(
    ["settings", "schedule"].includes(tab) ? "/admin/settings" : null,
  );
  const threads = useResource<Thread[]>(
    tab === "inbox" ? "/conversations" : null,
  );
  const posts = useResource<Post[]>(tab === "posts" ? "/admin/posts" : null);
  const [edit, setEdit] = useState<Service | null>(null),
    [threadId, setThreadId] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [bookingFilter, setBookingFilter] = useState("all");
  useEffect(() => {
    overview.reload();
    bookings.reload();
    threads.reload();
  }, [revision, overview.reload, bookings.reload, threads.reload]);
  useEffect(() => {
    setError("");
    setNotice("");
  }, [tab]);
  async function action(fn: () => Promise<unknown>, success = copy("已保存")) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveConfig(key: string, value: unknown) {
    await send(`/admin/settings/${key}`, value, "PUT");
    settings.reload();
    await refreshSite();
  }
  const currentThread = threadId || threads.data?.[0]?.id;
  return (
    <div className="admin-shell container">
      <aside className="admin-sidebar">
        <span className="eyebrow">{copy("YI FAN MANAGEMENT")}</span>
        <h1>{copy("品牌工作台")}</h1>
        <p>{copy("{v0}，欢迎回来。", { v0: user?.name })}</p>
        <nav aria-label={copy("后台导航")}>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={18} strokeWidth={1.4} />
              {copy(t.label)}
            </button>
          ))}
        </nav>
        <div className="admin-side-note">
          {copy("把每一个细节，")}
          <br />
          {copy("都留给美好的体验。")}
        </div>
      </aside>
      <section className="admin-content">
        <div className="admin-title">
          <h2>{copy(tabs.find((t) => t.id === tab)?.label || "")}</h2>
          <span>{copy("壹梵定制 · 品牌管理")}</span>
        </div>
        {notice && (
          <p className="success-notice" role="status">
            <Check size={17} />
            {notice}
          </p>
        )}
        <ErrorNotice
          error={
            error ||
            overview.error ||
            bookings.error ||
            services.error ||
            settings.error ||
            threads.error ||
            posts.error
          }
        />
        {tab === "overview" &&
          (overview.data ? (
            <>
              <div className="stats-grid">
                {[
                  { label: copy("注册顾客"), value: overview.data.customers },
                  { label: copy("累计预约"), value: overview.data.bookings },
                  { label: copy("待确认预约"), value: overview.data.awaiting },
                  {
                    label: copy("累计到账订金"),
                    value: `${money(overview.data.revenue)}`,
                  },
                ].map((s) => (
                  <div key={s.label}>
                    <span>{copy(s.label)}</span>
                    <strong>
                      {typeof s.value === "number" ? number(s.value) : s.value}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="admin-welcome">
                <span className="eyebrow">
                  {copy("CARE MAKES THE DIFFERENCE")}
                </span>
                <h3>{copy("用心服务，从这里开始。")}</h3>
                <p>
                  {copy(
                    "先完善正式套餐与营业档期，再配置品牌联系方式和支付渠道。客服收件箱会接收顾客的新消息。",
                  )}
                </p>
                <div className="admin-quick">
                  <button
                    className="button outline"
                    onClick={() => setTab("bookings")}
                  >
                    {copy("处理预约")}
                  </button>
                  <button className="button" onClick={() => setTab("inbox")}>
                    {copy("接待顾客")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Loading />
          ))}
        {tab === "bookings" && (
          <>
            <div className="admin-toolbar">
              <label>
                {copy("订单状态")}
                <select
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value)}
                >
                  <option value="all">{copy("全部订单")}</option>
                  {Object.entries(statusNames).map(([k, v]) => (
                    <option key={k} value={k}>
                      {copy(v)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="text-button" onClick={bookings.reload}>
                {copy("刷新订单")}
              </button>
            </div>
            {bookings.loading && !bookings.data ? (
              <Loading />
            ) : !bookings.data?.length ? (
              <Empty title={copy("还没有预约订单。")} />
            ) : (
              <div className="admin-order-list">
                {bookings.data
                  .filter(
                    (b) =>
                      bookingFilter === "all" || bookingFilter === b.status,
                  )
                  .map((b) => (
                    <article className="admin-order" key={b.id}>
                      <div>
                        <span className={`status ${b.status}`}>
                          {copy(statusNames[b.status])}
                        </span>
                        <span className="order-id">
                          {b.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <h3>{serviceTitle(b.service_id, b.service_title)}</h3>
                      <div className="admin-order-details">
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
                      {b.note && <p className="booking-note">{b.note}</p>}
                      {b.status === "refund_review" && (
                        <p className="error-notice">
                          {copy(
                            "过期后到账：请联系顾客核对档期或在支付平台完成退款，勿直接确认名额。",
                          )}
                        </p>
                      )}
                      <div className="admin-order-actions">
                        <button
                          className="text-button"
                          onClick={() => {
                            setThreadId(b.conversation_id);
                            setTab("inbox");
                          }}
                        >
                          {copy("联系顾客")}
                        </button>
                        {b.status === "paid" && (
                          <button
                            disabled={busy}
                            className="button small"
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
                            disabled={busy}
                            className="button outline small"
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
        {tab === "services" && (
          <>
            <div className="admin-toolbar">
              <p>{copy("价格与订金均以人民币计。停用后不影响已有订单。")}</p>
              <button
                className="button small"
                onClick={() => setEdit(blankService)}
              >
                <Plus size={16} />
                {copy("新增服务")}
              </button>
            </div>
            {services.loading ? (
              <Loading />
            ) : (
              <div className="admin-services">
                {services.data?.map((s) => (
                  <article key={s.id}>
                    <img src={s.image} alt="" />
                    <div>
                      <h3>
                        {serviceTitle(s.id, s.title)}
                        <span
                          className={`status ${s.active ? "confirmed" : "expired"}`}
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
                      <span className="subtle-note">
                        {localizeService(s, copy).duration} · {copy(s.category)}
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={copy("编辑{v0}", { v0: s.title })}
                      onClick={() => setEdit(s)}
                    >
                      <Pencil size={18} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "schedule" &&
          (settings.data ? (
            <ScheduleForm
              key={JSON.stringify(settings.data.booking)}
              config={settings.data.booking}
              busy={busy}
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
        {tab === "settings" &&
          (settings.data ? (
            <div className="settings-sections">
              <SiteForm
                config={settings.data.site}
                busy={busy}
                onSave={(value) =>
                  void action(
                    () => saveConfig("site", value),
                    copy("品牌资料已更新"),
                  )
                }
              />
              <EpayForm
                config={settings.data.epay}
                busy={busy}
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
        {tab === "inbox" && (
          <div className="admin-inbox">
            <div className="inbox-threads">
              {threads.loading && !threads.data ? (
                <Loading />
              ) : !threads.data?.length ? (
                <p className="form-note">
                  {copy("顾客发起咨询后，会话会出现在这里。")}
                </p>
              ) : (
                threads.data.map((t) => (
                  <button
                    className={currentThread === t.id ? "active" : ""}
                    onClick={() => setThreadId(t.id)}
                    key={t.id}
                  >
                    <strong>{t.customer_name}</strong>
                    <span>
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
            <div className="inbox-conversation">
              {currentThread ? (
                <ConversationView
                  key={currentThread}
                  threadId={currentThread}
                />
              ) : (
                <Empty title={copy("在这里，认真回应每一份期待。")} />
              )}
            </div>
          </div>
        )}
        {tab === "posts" && (
          <>
            {posts.loading ? (
              <Loading />
            ) : !posts.data?.length ? (
              <Empty title={copy("还没有社区故事。")} />
            ) : (
              <div className="admin-posts">
                {posts.data.map((p) => (
                  <article key={p.id}>
                    <div>
                      <span className="tag">{copy(p.category)}</span>
                      <span
                        className={`status ${p.hidden ? "expired" : "confirmed"}`}
                      >
                        {p.hidden ? copy("已隐藏") : copy("公开中")}
                      </span>
                    </div>
                    <h3>{p.title}</h3>
                    <p className="post-excerpt">{p.body.slice(0, 250)}</p>
                    <p className="subtle-note">
                      {p.author} · {dateTime(p.created_at)} ·{" "}
                      {copy(countMessages.replies, { count: p.comment_count })}
                    </p>
                    <button
                      className="button outline small"
                      disabled={busy}
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
        {edit && (
          <ServiceForm
            service={edit}
            onClose={() => setEdit(null)}
            onSaved={() => {
              setEdit(null);
              services.reload();
              void refreshSite();
              setNotice(copy("服务已保存"));
            }}
          />
        )}
      </section>
    </div>
  );
}

function ServiceForm({
  service: s,
  onClose,
  onSaved,
}: {
  service: Service;
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
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
        `/admin/services${s.id ? `/${s.id}` : ""}`,
        value,
        s.id ? "PUT" : "POST",
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={s.id ? copy("编辑 · {v0}", { v0: s.title }) : copy("新增定制服务")}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label>
            {copy("服务名称")}
            <input
              name="title"
              defaultValue={s.title}
              maxLength={60}
              required
            />
          </label>
          <label>
            {copy("服务分类")}
            <input
              name="category"
              defaultValue={s.category}
              maxLength={30}
              required
            />
          </label>
        </div>
        <label>
          {copy("英文副标题")}
          <input
            name="english"
            defaultValue={s.english}
            maxLength={80}
            required
          />
        </label>
        <label>
          {copy("服务介绍")}
          <textarea
            name="description"
            defaultValue={s.description}
            maxLength={1000}
            rows={3}
            required
          />
        </label>
        <div className="form-row">
          <label>
            {copy("套餐价格（元）")}
            <input
              name="price"
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              defaultValue={s.price / 100}
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
              defaultValue={s.deposit / 100}
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {copy("服务时长")}
            <input
              name="duration"
              defaultValue={s.duration}
              maxLength={60}
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
              defaultValue={s.sort_order}
              required
            />
          </label>
        </div>
        <label>
          {copy("套餐内容（每行一项，最多 10 项）")}
          <textarea
            name="features"
            defaultValue={s.features.join("\n")}
            rows={4}
            required
          />
        </label>
        <label>
          {copy("展示配图")}
          <select name="image" defaultValue={s.image}>
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
          </select>
        </label>
        <div className="form-row">
          <label className="checkbox-label">
            <input type="checkbox" name="active" defaultChecked={s.active} />
            {copy("上架该服务")}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={s.featured}
            />
            {copy("标记壹梵精选")}
          </label>
        </div>
        <ErrorNotice error={error} />
        <button className="button full" disabled={busy}>
          {busy ? copy("保存中…") : copy("保存服务")}
        </button>
      </form>
    </Modal>
  );
}
function ScheduleForm({
  config,
  busy,
  onSave,
}: {
  config: BookingConfig;
  busy: boolean;
  onSave: (v: BookingConfig) => void;
}) {
  const copy = useCopy();
  const { weekday } = useFormatting();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    onSave({
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
  return (
    <form className="form settings-form" onSubmit={submit}>
      <h3>{copy("预约档期")}</h3>
      <p className="subtle-note">
        {copy("容量为全店每时段可承接的预约数。时间均为北京时间。")}
      </p>
      <label className="checkbox-label">
        <input name="enabled" type="checkbox" defaultChecked={config.enabled} />
        {copy("开放在线预约")}
      </label>
      <label>
        {copy("每日可预约时段（以逗号分隔）")}
        <input
          name="times"
          defaultValue={config.times.join(", ")}
          placeholder="10:00, 13:00, 15:00, 17:00"
          required
        />
      </label>
      <div className="form-row">
        <label>
          {copy("每时段容量")}
          <input
            name="capacity"
            type="number"
            min={1}
            max={50}
            defaultValue={config.capacity}
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
            defaultValue={config.minAdvanceDays}
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
            defaultValue={config.maxAdvanceDays}
            required
          />
        </label>
      </div>
      <fieldset>
        <legend>{copy("每周休息日")}</legend>
        <div className="weekday-choices">
          {["日", "一", "二", "三", "四", "五", "六"].map((day, i) => (
            <label key={day}>
              <input
                name="closed"
                type="checkbox"
                value={i}
                defaultChecked={config.closedWeekdays.includes(i)}
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
          defaultValue={config.blockedDates.join(", ")}
          placeholder="2026-12-25, 2027-01-01"
          rows={3}
        />
      </label>
      <p className="info-notice">
        {copy(
          "修改档期只影响新的预约，不会自动取消已创建的订单；请提前与已有预约的顾客沟通。",
        )}
      </p>
      <button className="button" disabled={busy}>
        {busy ? copy("保存中…") : copy("保存档期设置")}
      </button>
    </form>
  );
}
function SiteForm({
  config,
  busy,
  onSave,
}: {
  config: SiteConfig;
  busy: boolean;
  onSave: (v: SiteConfig) => void;
}) {
  const copy = useCopy();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    onSave({
      phone: String(d.get("phone")),
      address: String(d.get("address")),
      hours: String(d.get("hours")),
      wechat: String(d.get("wechat")),
      samplePricing: d.get("sample") === "on",
    });
  }
  return (
    <form className="form settings-form" onSubmit={submit}>
      <h3>{copy("品牌联系资料")}</h3>
      <div className="form-row">
        <label>
          {copy("联系电话")}
          <input name="phone" defaultValue={config.phone} maxLength={40} />
        </label>
        <label>
          {copy("微信咨询号")}
          <input name="wechat" defaultValue={config.wechat} maxLength={80} />
        </label>
      </div>
      <label>
        {copy("门店地址")}
        <input name="address" defaultValue={config.address} maxLength={200} />
      </label>
      <label>
        {copy("服务时间")}
        <input
          name="hours"
          defaultValue={config.hours}
          maxLength={100}
          required
        />
      </label>
      <label className="checkbox-label">
        <input
          name="sample"
          type="checkbox"
          defaultChecked={config.samplePricing}
        />
        {copy("显示“示例套餐与价格”提示（正式定价后可关闭）")}
      </label>
      <button className="button" disabled={busy}>
        {copy("保存品牌资料")}
      </button>
    </form>
  );
}
function EpayForm({
  config,
  busy,
  onSave,
}: {
  config: AdminSettings["epay"];
  busy: boolean;
  onSave: (v: unknown) => void;
}) {
  const copy = useCopy();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    onSave({
      enabled: d.get("enabled") === "on",
      gateway: String(d.get("gateway")),
      pid: String(d.get("pid")),
      secret: String(d.get("secret")),
      methods: d.getAll("method"),
    });
  }
  return (
    <form className="form settings-form" onSubmit={submit}>
      <h3>{copy("易支付 Epay")}</h3>
      <p className="subtle-note">
        {copy(
          "适用于传统 submit.php / MD5 协议。请填写实际支付服务提供方的商户资料。",
        )}
      </p>
      <label className="checkbox-label">
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} />
        {copy("启用在线支付")}
      </label>
      <label>
        {copy("网关根目录（HTTPS）")}
        <input
          type="url"
          name="gateway"
          defaultValue={config.gateway}
          placeholder="https://pay.example.com/"
          maxLength={300}
        />
      </label>
      <label>
        {copy("商户号 PID")}
        <input
          name="pid"
          defaultValue={config.pid}
          inputMode="numeric"
          maxLength={40}
        />
      </label>
      <label>
        {copy("商户密钥")}
        <input
          name="secret"
          type="password"
          autoComplete="new-password"
          placeholder={
            config.hasSecret
              ? copy("已设置密钥；留空保留原密钥")
              : copy("请输入商户密钥")
          }
          maxLength={200}
        />
      </label>
      <fieldset>
        <legend>{copy("可用支付方式")}</legend>
        <div className="weekday-choices">
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
                defaultChecked={config.methods.includes(key)}
              />
              {copy(label)}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="info-notice">
        {copy(
          "正式收款前需设置本站 HTTPS 域名，并在支付平台确认异步通知可以访问。已发起的支付使用发起时的商户配置核验回调。",
        )}
      </p>
      <button className="button" disabled={busy}>
        {copy("保存支付设置")}
      </button>
    </form>
  );
}
