"use client";
import { useCopy, useFormatting, countMessages } from "../i18n";

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "../routing";
import { Check, CalendarDays, Clock3, ShieldCheck } from "lucide-react";
import {
  useSite,
  useResource,
  send,
  chinaDate,
  type Service,
  type Booking,
} from "../lib";
import { Arrow, ErrorNotice, Modal, Loading } from "../components";
import ConsentText from "../ConsentText";

export default function Services() {
  const { money } = useFormatting();
  const copy = useCopy();
  const { services, settings, user } = useSite();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Service | null>(null),
    [filter, setFilter] = useState(params.get("category") || "全部服务");
  useEffect(() => {
    const service = services.find((s) => s.id === params.get("book"));
    if (service && user) setSelected(service);
  }, [params, services, user]);
  function book(service: Service) {
    if (!user) {
      navigate(
        `/login?next=${encodeURIComponent(`/services?book=${service.id}`)}`,
      );
      return;
    }
    setSelected(service);
  }
  const filters = ["全部服务", ...new Set(services.map((s) => s.category))];
  return (
    <div className="page services-page container">
      <div className="page-title">
        <span className="eyebrow">{copy("MADE FOR YOU, AND ONLY YOU")}</span>
        <h1>{copy("你的美好，专属定制。")}</h1>
        <p>
          {copy("从婚纱影像到个人表达，从重要庆典到日常心动。")}
          <br />
          {copy("用恰到好处的仪式感，回应独一无二的你。")}
        </p>
      </div>
      <div className="filter-tabs" role="group" aria-label={copy("服务分类")}>
        {filters.map((f) => (
          <button
            onClick={() => setFilter(f)}
            className={filter === f ? "active" : ""}
            aria-pressed={filter === f}
            key={f}
          >
            {copy(f)}
          </button>
        ))}
      </div>
      {settings?.site.samplePricing && (
        <p className="subtle-note">
          {copy("当前展示示例套餐与价格，正式方案及报价请与顾问沟通确认。")}
        </p>
      )}
      <div className="packages-grid">
        {services
          .filter((s) => filter === "全部服务" || s.category === filter)
          .map((service) => (
            <article className="package-card" key={service.id}>
              <div className="image-wrap">
                <img
                  src={service.image}
                  alt={copy("{v0}风格示意", { v0: service.title })}
                  loading="lazy"
                />
                {service.featured && (
                  <span className="package-badge">{copy("壹梵精选")}</span>
                )}
              </div>
              <div className="package-content">
                <span className="eyebrow">{service.english}</span>
                <h2>{service.title}</h2>
                <p className="package-description">{service.description}</p>
                <div className="package-price">
                  <strong>{money(service.price)}</strong>
                  <span>{copy("套餐参考价")}</span>
                  <span className="duration">
                    <Clock3 size={14} />
                    {service.duration}
                  </span>
                </div>
                <ul className="feature-list">
                  {service.features.map((f) => (
                    <li key={f}>
                      <Check size={15} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className="button full"
                  onClick={() => book(service)}
                  disabled={!settings?.booking.enabled}
                >
                  {copy("预约专属体验")}
                  <Arrow />
                </button>
                <p className="deposit-note">
                  {copy("预约订金 ¥{v0} · 抵扣套餐费用", {
                    v0: money(service.deposit),
                  })}
                </p>
              </div>
            </article>
          ))}
      </div>
      {!services.length && <Loading />}
      <div className="service-assurance">
        <span>
          <CalendarDays size={21} strokeWidth={1.2} />
          {copy("按你的节奏，预约专属时间")}
        </span>
        <span>
          <ShieldCheck size={21} strokeWidth={1.2} />
          {copy("订单与沟通记录，安心可查")}
        </span>
        <span>{copy("女生 · 男生 · 每一种自我表达")}</span>
      </div>
      {selected && (
        <BookingModal
          service={selected}
          onClose={() => {
            setSelected(null);
            if (params.has("book")) {
              params.delete("book");
              setParams(params, { replace: true });
            }
          }}
        />
      )}
    </div>
  );
}

function BookingModal({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  const { money } = useFormatting();
  const copy = useCopy();
  const { settings, user } = useSite();
  const navigate = useNavigate();
  const [day, setDay] = useState(
      chinaDate(settings?.booking.minAdvanceDays || 1),
    ),
    [time, setTime] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const slots = useResource<{ time: string; remaining: number }[]>(
    `/availability?date=${day}`,
  );
  useEffect(() => setTime(""), [day]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!time) {
      setError(copy("请选择一个可预约时段"));
      return;
    }
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await send<Booking>("/bookings", {
        serviceId: service.id,
        day,
        time,
        contactName: data.get("name"),
        phone: data.get("phone"),
        note: data.get("note"),
        requestKey: key,
      });
      onClose();
      navigate("/account?new=1");
    } catch (e) {
      setError((e as Error).message);
      slots.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={copy("预约你的专属时刻")} onClose={onClose}>
      <div className="booking-summary">
        <img src={service.image} alt="" />
        <div>
          <span className="eyebrow">{service.english}</span>
          <h3>{service.title}</h3>
          <p>
            {copy("套餐 ¥{v0} · 订金", { v0: money(service.price) })}
            <strong>{money(service.deposit)}</strong>
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="form">
        <label>
          {copy("预约日期")}
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            min={chinaDate(settings?.booking.minAdvanceDays ?? 1)}
            max={chinaDate(settings?.booking.maxAdvanceDays ?? 90)}
            required
          />
        </label>
        <fieldset>
          <legend>
            {copy("选择时段")}
            <small>{copy("北京时间")}</small>
          </legend>
          {slots.loading ? (
            <Loading />
          ) : (
            <div className="time-slots">
              {slots.data?.map((s) => (
                <button
                  type="button"
                  key={s.time}
                  disabled={!s.remaining}
                  aria-pressed={time === s.time}
                  onClick={() => setTime(s.time)}
                  className={time === s.time ? "selected" : ""}
                >
                  {s.time}
                  <small>
                    {s.remaining
                      ? copy(countMessages.places, { count: s.remaining })
                      : copy("不可预约")}
                  </small>
                </button>
              ))}
            </div>
          )}
        </fieldset>
        <ErrorNotice error={slots.error} />
        <div className="form-row">
          <label>
            {copy("怎么称呼你")}
            <input
              name="name"
              defaultValue={user?.name}
              maxLength={30}
              autoComplete="name"
              required
            />
          </label>
          <label>
            {copy("联系电话")}
            <input
              name="phone"
              type="tel"
              placeholder={copy("便于顾问与你沟通")}
              pattern="\+?[0-9\s\-]{7,20}"
              autoComplete="tel"
              required
            />
          </label>
        </div>
        <label>
          {copy("想与我们分享的期待")}
          <span className="optional">{copy("选填")}</span>
          <textarea
            name="note"
            maxLength={1000}
            placeholder={copy("拍摄风格、角色主题、庆典想法，或其他特别需求…")}
            rows={3}
          />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" required />
          <ConsentText />
        </label>
        <ErrorNotice error={error} />
        <button className="button full" disabled={busy || slots.loading}>
          {busy ? copy("正在预约…") : copy("确认预约，前往订单")}
          <Arrow />
        </button>
        <p className="form-note">
          {copy("名额保留 30 分钟，请在订单页完成订金支付。")}
          <br />
          {copy("预约专属会话保留 180 天。")}
        </p>
      </form>
    </Modal>
  );
}
