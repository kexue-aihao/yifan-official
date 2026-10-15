"use client";
import { useCopy, useFormatting, useServiceTitle } from "../i18n";

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "../routing";
import {
  CalendarDays,
  Clock3,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { useSite, useResource, send, statusNames, type Booking } from "../lib";
import { Arrow, Empty, ErrorNotice, Loading, Modal } from "../components";

export default function Account() {
  const { money, date, time } = useFormatting();
  const serviceTitle = useServiceTitle();
  const copy = useCopy();
  const { user, settings, revision, openChat } = useSite();
  const bookings = useResource<Booking[]>("/bookings");
  const [params] = useSearchParams();
  const [filter, setFilter] = useState("全部预约"),
    [error, setError] = useState("");
  const [pay, setPay] = useState<Booking | null>(null),
    [cancel, setCancel] = useState<Booking | null>(null),
    [busy, setBusy] = useState(false);
  const [method, setMethod] = useState(
    settings?.payment.methods[0] || "alipay",
  );
  useEffect(() => bookings.reload(), [revision, bookings.reload]);
  useEffect(() => {
    if (!params.has("payment")) return;
    let count = 0;
    const timer = setInterval(() => {
      bookings.reload();
      if (++count >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [params, bookings.reload]);
  async function checkout() {
    if (!pay) return;
    setBusy(true);
    setError("");
    try {
      const data = await send<{ url: string }>("/payments/epay/create", {
        bookingId: pay.id,
        method,
      });
      window.location.assign(data.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function cancelBooking() {
    if (!cancel) return;
    setBusy(true);
    setError("");
    try {
      await send(`/bookings/${cancel.id}/cancel`, {});
      setCancel(null);
      bookings.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filters = ["全部预约", "待付订金", "进行中", "已结束"];
  const visible = bookings.data?.filter(
    (b) =>
      filter === "全部预约" ||
      (filter === "待付订金" && b.status === "pending") ||
      (filter === "进行中" &&
        ["paid", "confirmed", "refund_review"].includes(b.status)) ||
      (filter === "已结束" &&
        ["completed", "expired", "cancelled"].includes(b.status)),
  );
  return (
    <div className="page container account-page">
      <div className="account-heading">
        <div>
          <span className="eyebrow">{copy("YOUR PERSONAL YI FAN")}</span>
          <h1>{copy("{v0}，美好正在发生。", { v0: user?.name })}</h1>
          <p>{copy("在这里，查看你的专属预约，继续与顾问的对话。")}</p>
        </div>
        <Link className="button" to="/services">
          {copy("预约新的体验")}
          <Arrow />
        </Link>
      </div>
      {params.has("new") && (
        <div className="success-notice">
          <CheckCircle2 size={19} />
          {copy(
            "预约已创建，请在 30 分钟内支付订金。若支付尚未开通，请联系顾问。",
          )}
        </div>
      )}
      {params.has("payment") && (
        <div className="info-notice">
          {copy(
            "已返回订单页，正在查询支付结果。订单以支付平台通知的到账状态为准；尚未更新时可稍后刷新或联系顾问。",
          )}
        </div>
      )}
      <div className="account-toolbar">
        <div className="filter-tabs">
          {filters.map((f) => (
            <button
              className={f === filter ? "active" : ""}
              onClick={() => setFilter(f)}
              key={f}
            >
              {copy(f)}
            </button>
          ))}
        </div>
        <button className="text-button" onClick={bookings.reload}>
          <RefreshCw size={15} />
          {copy("刷新")}
        </button>
      </div>
      <ErrorNotice error={bookings.error || error} />
      {bookings.loading && !bookings.data ? (
        <Loading />
      ) : !visible?.length ? (
        <Empty title={copy("留一个时刻，给值得的自己。")}>
          <p>{copy("这里将记录你的每一次专属体验。")}</p>
          <Link className="button" to="/services">
            {copy("探索定制服务")}
            <Arrow />
          </Link>
        </Empty>
      ) : (
        <div className="bookings-list">
          {visible.map((b) => (
            <article className="booking-card" key={b.id}>
              <div className="booking-top">
                <span className="order-id">
                  {copy("预约编号 {v0}", {
                    v0: b.id.slice(0, 8).toUpperCase(),
                  })}
                </span>
                <span className={`status ${b.status}`}>
                  {copy(statusNames[b.status])}
                </span>
              </div>
              <div className="booking-body">
                <div>
                  <h2>{serviceTitle(b.service_id, b.service_title)}</h2>
                  <div className="booking-meta">
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
                    <p className="booking-note">
                      {copy("你的期待：{v0}", { v0: b.note })}
                    </p>
                  )}
                  {b.status === "pending" && (
                    <p className="subtle-note">
                      {copy("名额保留至 {v0}，到期将自动释放。", {
                        v0: time(b.expires_at),
                      })}
                    </p>
                  )}
                  {b.status === "refund_review" && (
                    <p className="error-notice">
                      {copy(
                        "订单保留时间过后收到款项，顾问将协助核对档期或处理退款，请及时联系。",
                      )}
                    </p>
                  )}
                </div>
                <div className="booking-amount">
                  <span>{copy("预约订金")}</span>
                  <strong>{money(b.deposit)}</strong>
                  <span>{copy("套餐总价 ¥{v0}", { v0: money(b.price) })}</span>
                </div>
              </div>
              <div className="booking-actions">
                <button
                  className="text-button"
                  onClick={() => openChat(b.conversation_id)}
                >
                  <MessageCircle size={16} />
                  {copy("预约专属会话")}
                </button>
                <div>
                  {b.status === "pending" && (
                    <>
                      {!b.payment_id && (
                        <button
                          className="text-button muted"
                          onClick={() => {
                            setError("");
                            setCancel(b);
                          }}
                        >
                          {copy("取消预约")}
                        </button>
                      )}
                      <button
                        className="button small"
                        onClick={() => {
                          setError("");
                          setPay(b);
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
      <p className="form-note">
        {copy(
          "预约专属会话保留 180 天；已支付订单的改期与退款，请与顾问协商确认。",
        )}
      </p>
      {pay && (
        <Modal title={copy("支付预约订金")} onClose={() => setPay(null)}>
          <div className="payment-total">
            <span>{serviceTitle(pay.service_id, pay.service_title)}</span>
            <strong>{money(pay.deposit)}</strong>
            <p>
              {date(pay.day)} · {pay.time}
            </p>
          </div>
          {settings?.payment.available ? (
            <>
              <fieldset className="payment-methods">
                <legend>{copy("选择支付方式")}</legend>
                {settings.payment.methods.map((m) => (
                  <label key={m} className={method === m ? "selected" : ""}>
                    <input
                      type="radio"
                      name="paymethod"
                      checked={method === m}
                      onChange={() => setMethod(m)}
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
              <ErrorNotice error={error} />
              <button
                className="button full"
                disabled={busy}
                onClick={() => void checkout()}
              >
                {busy ? copy("正在跳转…") : copy("前往安全收银台")}
                <Arrow />
              </button>
              <p className="form-note">
                {copy("由支付平台完成收款，支付后可返回查看订单。")}
              </p>
            </>
          ) : (
            <div className="info-notice">
              <h3>{copy("在线支付尚未开通")}</h3>
              <p>{copy("请联系专属顾问，沟通预约安排。")}</p>
              <button
                className="button full"
                onClick={() => {
                  setPay(null);
                  openChat(pay.conversation_id);
                }}
              >
                {copy("联系顾问")}
                <Arrow />
              </button>
            </div>
          )}
        </Modal>
      )}
      {cancel && (
        <Modal title={copy("取消这次预约？")} onClose={() => setCancel(null)}>
          <p>
            {copy("取消后将释放 {v0}{v1} 的名额，你仍可随时重新预约。", {
              v0: date(cancel.day),
              v1: ` ${cancel.time}`,
            })}
          </p>
          <ErrorNotice error={error} />
          <div className="modal-actions">
            <button className="button outline" onClick={() => setCancel(null)}>
              {copy("保留预约")}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void cancelBooking()}
            >
              {busy ? copy("处理中…") : copy("确认取消预约")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
