<script lang="tsx">
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCw,
} from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onMounted,
  ref as vueRef,
  watch,
} from "vue";
import { Arrow, Empty, ErrorNotice, Loading, Modal } from "../components.vue";
import { useCopy, useFormatting, useServiceTitle } from "../i18n.vue";
import {
  send,
  statusNames,
  useResource,
  useSite,
  type Booking,
} from "../lib.vue";
import { Link, useSearchParams } from "../routing.vue";
const Account = defineComponent(
  () => {
    const { money, date, time, dateTime } = useFormatting();
    const serviceTitle = useServiceTitle();
    const copy = useCopy();
    const site = useSite();
    const bookings = useResource<Booking[]>(() => "/bookings");
    const [params] = useSearchParams();
    const filter = vueRef("全部预约");
    const error = vueRef("");
    const pay = vueRef<Booking | null>(null);
    const cancel = vueRef<Booking | null>(null);
    const busy = vueRef(false);
    const method = vueRef(site.settings?.payment.methods[0] || "alipay");
    onMounted(() => {
      watch(
        () => [site.revision, bookings.reload],
        () => {
          bookings.reload();
        },
        { immediate: true, flush: "post" },
      );
    });
    onMounted(() => {
      watch(
        () => [params.value, bookings.reload],
        (_next, _previous, onCleanup) => {
          if (!params.value.has("payment")) return;
          let count = 0;
          const timer = setInterval(() => {
            bookings.reload();
            if (++count >= 10) clearInterval(timer);
          }, 3000);
          onCleanup(() => clearInterval(timer));
        },
        { immediate: true, flush: "post" },
      );
    });
    async function checkout() {
      if (!pay.value) return;
      busy.value = true;
      error.value = "";
      try {
        const data = await send<{
          url: string;
        }>("/payments/epay/create", {
          bookingId: pay.value.id,
          method: method.value,
        });
        window.location.assign(data.url);
      } catch (e) {
        error.value = (e as Error).message;
        busy.value = false;
      }
    }
    async function cancelBooking() {
      if (!cancel.value) return;
      busy.value = true;
      error.value = "";
      try {
        await send(`/bookings/${cancel.value.id}/cancel`, {});
        cancel.value = null;
        bookings.reload();
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    const filters = computed(() => [
      "全部预约",
      "待付订金",
      "进行中",
      "已结束",
    ]);
    const visible = computed(() =>
      bookings.data?.filter(
        (b) =>
          filter.value === "全部预约" ||
          (filter.value === "待付订金" && b.status === "pending") ||
          (filter.value === "进行中" &&
            ["paid", "confirmed", "refund_review"].includes(b.status)) ||
          (filter.value === "已结束" &&
            ["completed", "expired", "cancelled"].includes(b.status)),
      ),
    );
    const accountStats = computed(() => {
      const list = bookings.data || [];
      const value = (count: number) => (bookings.data ? count : "—");
      return [
        {
          label: copy("全部预约"),
          value: value(list.length),
          note: copy("已创建的专属时刻"),
          icon: CalendarDays,
        },
        {
          label: copy("待付订金"),
          value: value(
            list.filter((booking) => booking.status === "pending").length,
          ),
          note: copy("需要尽快完成支付"),
          icon: Clock3,
        },
        {
          label: copy("进行中"),
          value: value(
            list.filter((booking) =>
              ["paid", "confirmed", "refund_review"].includes(booking.status),
            ).length,
          ),
          note: copy("顾问正在为你安排"),
          icon: MessageCircle,
        },
        {
          label: copy("已完成"),
          value: value(
            list.filter((booking) => booking.status === "completed").length,
          ),
          note: copy("值得珍藏的记录"),
          icon: CheckCircle2,
        },
      ];
    });
    return () => (
      <div class="page container account-page">
        <div class="account-heading">
          <div>
            <span class="eyebrow">{copy("YOUR PERSONAL YI FAN")}</span>
            <h1>{copy("{v0}，美好正在发生。", { v0: site.user?.name })}</h1>
            <p>{copy("在这里，查看你的专属预约，继续与顾问的对话。")}</p>
          </div>
          <Link class="button" to="/services">
            {copy("预约新的体验")}
            <Arrow />
          </Link>
        </div>
        {params.value.has("new") && (
          <div class="success-notice">
            <CheckCircle2 size={19} />
            {copy(
              "预约已创建，请在 30 分钟内支付订金。若支付尚未开通，请联系顾问。",
            )}
          </div>
        )}
        {params.value.has("payment") && (
          <div class="info-notice">
            {copy(
              "已返回订单页，正在查询支付结果。订单以支付平台通知的到账状态为准；尚未更新时可稍后刷新或联系顾问。",
            )}
          </div>
        )}
        <div class="account-summary" aria-label={copy("预约概览")}>
          {accountStats.value.map((stat) => (
            <article class="account-stat-card" key={stat.label}>
              <div class="account-stat-icon" aria-hidden="true">
                <stat.icon size={18} strokeWidth={1.7} />
              </div>
              <div class="account-stat-copy">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.note}</small>
              </div>
            </article>
          ))}
        </div>
        <div class="account-toolbar">
          <div class="filter-tabs">
            {filters.value.map((f) => (
              <button
                class={f === filter.value ? "active" : ""}
                onClick={() => (filter.value = f)}
                key={f}
              >
                {copy(f)}
              </button>
            ))}
          </div>
          <button class="text-button" onClick={bookings.reload}>
            <RefreshCw size={15} />
            {copy("刷新")}
          </button>
        </div>
        <ErrorNotice error={bookings.error || error.value} />
        {bookings.loading && !bookings.data ? (
          <Loading />
        ) : !visible.value?.length ? (
          <Empty title={copy("留一个时刻，给值得的自己。")}>
            <p>{copy("这里将记录你的每一次专属体验。")}</p>
            <Link class="button" to="/services">
              {copy("探索定制服务")}
              <Arrow />
            </Link>
          </Empty>
        ) : (
          <div class="bookings-list">
            {visible.value.map((b) => (
              <article class="booking-card" key={b.id}>
                <div class="booking-top">
                  <span class="order-id">
                    {copy("预约编号 {v0}", {
                      v0: b.id.slice(0, 8).toUpperCase(),
                    })}
                  </span>
                  <span class={`status ${b.status}`}>
                    {copy(statusNames[b.status])}
                  </span>
                </div>
                <div class="booking-body">
                  <div>
                    <h2>{serviceTitle(b.service_id, b.service_title)}</h2>
                    <div class="booking-meta">
                      <span>
                        <CalendarDays size={15} />
                        {date(b.day)}
                      </span>
                      <span>
                        <Clock3 size={15} />
                        {copy("{v0}（北京时间）", { v0: b.time })}
                      </span>
                    </div>
                    <p>
                      {b.contact_name} · {b.phone}
                    </p>
                    {b.note && (
                      <p class="booking-note">
                        {copy("你的期待：{v0}", { v0: b.note })}
                      </p>
                    )}
                    {b.status === "pending" && (
                      <p class="subtle-note">
                        {copy("名额保留至 {v0}，到期将自动释放。", {
                          v0: time(b.expires_at),
                        })}
                      </p>
                    )}
                    {b.status === "refund_review" && (
                      <p class="error-notice">
                        {copy(
                          "订单保留时间过后收到款项，顾问将协助核对档期或处理退款，请及时联系。",
                        )}
                      </p>
                    )}
                  </div>
                  <div class="booking-amount">
                    <span>{copy("预约订金")}</span>
                    <strong>{money(b.deposit)}</strong>
                    <span>
                      {copy("套餐总价 ¥{v0}", { v0: money(b.price) })}
                    </span>
                  </div>
                </div>
                <p
                  class={
                    b.staff_viewed_at
                      ? "booking-read-status read"
                      : "booking-read-status"
                  }
                >
                  {b.staff_viewed_at
                    ? copy("工作人员已查看 · {v0}", {
                        v0: dateTime(b.staff_viewed_at),
                      })
                    : copy("待工作人员查看")}
                </p>
                <div class="booking-actions">
                  <button
                    class="text-button"
                    onClick={() => site.openChat(b.conversation_id)}
                  >
                    <MessageCircle size={16} />
                    {copy("预约专属会话")}
                  </button>
                  <div>
                    {b.status === "pending" && (
                      <>
                        {!b.payment_id && (
                          <button
                            class="text-button muted"
                            onClick={() => {
                              error.value = "";
                              cancel.value = b;
                            }}
                          >
                            {copy("取消预约")}
                          </button>
                        )}
                        <button
                          class="button small"
                          onClick={() => {
                            error.value = "";
                            pay.value = b;
                          }}
                        >
                          {copy("支付订金")}
                          <Arrow />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <p class="form-note">
          {copy(
            "预约专属会话保留 180 天；已支付订单的改期与退款，请与顾问协商确认。",
          )}
        </p>
        {pay.value && (
          <Modal
            title={copy("支付预约订金")}
            onClose={() => (pay.value = null)}
          >
            <div class="payment-total">
              <span>
                {serviceTitle(pay.value.service_id, pay.value.service_title)}
              </span>
              <strong>{money(pay.value.deposit)}</strong>
              <p>
                {date(pay.value.day)} · {pay.value.time}
              </p>
            </div>
            {site.settings?.payment.available ? (
              <>
                <fieldset class="payment-methods">
                  <legend>{copy("选择支付方式")}</legend>
                  {site.settings.payment.methods.map((m) => (
                    <label key={m} class={method.value === m ? "selected" : ""}>
                      <input
                        type="radio"
                        name="paymethod"
                        checked={method.value === m}
                        onInput={() => (method.value = m)}
                      />
                      {
                        (
                          {
                            alipay: copy("支付宝"),
                            wxpay: copy("微信支付"),
                            qqpay: copy("QQ 钱包"),
                          } as Record<string, string>
                        )[m]
                      }
                    </label>
                  ))}
                </fieldset>
                <ErrorNotice error={error.value} />
                <button
                  class="button full"
                  disabled={busy.value}
                  onClick={() => void checkout()}
                >
                  {busy.value ? copy("正在跳转…") : copy("前往安全收银台")}
                  <Arrow />
                </button>
                <p class="form-note">
                  {copy("由支付平台完成收款，支付后可返回查看订单。")}
                </p>
              </>
            ) : (
              <div class="info-notice">
                <h3>{copy("在线支付尚未开通")}</h3>
                <p>{copy("请联系专属顾问，沟通预约安排。")}</p>
                <button
                  class="button full"
                  onClick={() => {
                    const thread = pay.value?.conversation_id;
                    pay.value = null;
                    site.openChat(thread);
                  }}
                >
                  {copy("联系顾问")}
                  <Arrow />
                </button>
              </div>
            )}
          </Modal>
        )}
        {cancel.value && (
          <Modal
            title={copy("取消这次预约？")}
            onClose={() => (cancel.value = null)}
          >
            <p>
              {copy("取消后将释放 {v0}{v1} 的名额，你仍可随时重新预约。", {
                v0: date(cancel.value.day),
                v1: ` ${cancel.value.time}`,
              })}
            </p>
            <ErrorNotice error={error.value} />
            <div class="modal-actions">
              <button
                class="button outline"
                onClick={() => (cancel.value = null)}
              >
                {copy("保留预约")}
              </button>
              <button
                class="button"
                disabled={busy.value}
                onClick={() => void cancelBooking()}
              >
                {busy.value ? copy("处理中…") : copy("确认取消预约")}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  },
  { name: "Account", props: [] },
);
export default Account;
</script>
