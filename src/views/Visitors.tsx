"use client";
import { useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { useCopy, useFormatting } from "../i18n";
import { useResource } from "../lib";
import { ErrorNotice, Loading, Modal } from "../components";
type Location = {
  country: string;
  region: string;
  city: string;
  geo_status: string;
  source: string;
};
type IP = Location & {
  ip: string;
  occurrence_count: number;
  page_count: number;
  booking_count: number;
  message_count: number;
  user_count: number;
  first_seen: number;
  last_seen: number;
};
type Visit = Location & {
  id: string;
  user_id: string | null;
  user_name: string | null;
  ip: string;
  kind: string;
  path: string;
  booking_id: string | null;
  conversation_id: string | null;
  created_at: number;
};
const kinds: Record<string, string> = {
  page: "页面访问",
  register: "注册",
  login: "登录",
  booking: "预约提交",
  conversation: "打开会话",
  message: "发送消息",
};
function Place({ value }: { value: Location }) {
  const copy = useCopy();
  const locale = useLocale();
  let country = value.country;
  try {
    if (country)
      country =
        new Intl.DisplayNames([locale], { type: "region" }).of(country) ||
        country;
  } catch {}
  return (
    <span title={value.source}>
      {value.geo_status === "private"
        ? copy("内网 / 本机")
        : value.geo_status === "unknown"
          ? copy("归属地未知")
          : [country, value.region, value.city].filter(Boolean).join(" · ") ||
            copy("归属地未知")}
    </span>
  );
}
function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const copy = useCopy();
  return (
    <div className="visitor-pager">
      <button
        className="button outline small"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {copy("上一页")}
      </button>
      <span>
        {page} / {Math.max(1, Math.ceil(total / 25))}
      </span>
      <button
        className="button outline small"
        disabled={page * 25 >= total}
        onClick={() => onChange(page + 1)}
      >
        {copy("下一页")}
      </button>
    </div>
  );
}
export function AccessHistory({ query }: { query: string }) {
  const copy = useCopy();
  const { dateTime } = useFormatting();
  const [page, setPage] = useState(1);
  const records = useResource<{ items: Visit[]; total: number }>(
    `/admin/visitor-events?${query}&page=${page}`,
  );
  return (
    <div className="access-history">
      <ErrorNotice error={records.error} />
      {records.loading ? (
        <Loading />
      ) : !records.data?.items.length ? (
        <p className="form-note">{copy("暂无访问记录，历史 IP 不会补填。")}</p>
      ) : (
        <>
          <div className="visitor-event-list">
            {records.data.items.map((e) => (
              <article key={e.id}>
                <div>
                  <strong>{copy(kinds[e.kind] || e.kind)}</strong>
                  <time>{dateTime(e.created_at)}</time>
                </div>
                <p>
                  <code>{e.ip}</code> · <Place value={e} />
                </p>
                <p>
                  {copy("注册 ID")}：
                  <code>{e.user_id || copy("未登录访客")}</code>
                  {e.user_name && ` · ${e.user_name}`}
                </p>
                {e.path && (
                  <p>
                    {copy("页面")}：{e.path}
                  </p>
                )}
                {e.booking_id && (
                  <p>
                    {copy("预约编号")}：<code>{e.booking_id}</code>
                  </p>
                )}
                {e.conversation_id && (
                  <p>
                    {copy("会话编号")}：<code>{e.conversation_id}</code>
                  </p>
                )}
              </article>
            ))}
          </div>
          <Pager page={page} total={records.data.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
export default function Visitors() {
  const copy = useCopy();
  const { dateTime, number } = useFormatting();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [ip, setIP] = useState("");
  const records = useResource<{
    items: IP[];
    totals: { ips: number; occurrences: number; pages: number; users: number };
  }>(`/admin/visitors?search=${encodeURIComponent(search)}&page=${page}`);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearch(String(new FormData(e.currentTarget).get("search") || "").trim());
    setPage(1);
  }
  return (
    <div className="visitor-panel">
      <p className="form-note">
        {copy(
          "保留最近 180 天。访问次数仅计页面访问；出现次数包含注册、登录、预约与会话操作。归属地为 IP 数据库估算。",
        )}
      </p>
      <form className="visitor-search" onSubmit={submit}>
        <label>
          {copy("IP / 注册 ID / 邮箱 / 称呼")}
          <input
            name="search"
            maxLength={160}
            placeholder={copy("输入完整值搜索")}
          />
        </label>
        <button className="button small">{copy("搜索")}</button>
        <button
          type="button"
          className="button outline small"
          onClick={() => records.reload()}
        >
          {copy("刷新记录")}
        </button>
      </form>
      <ErrorNotice error={records.error} />
      {records.data && (
        <div className="stats-grid">
          {[
            ["不同 IP", records.data.totals.ips],
            ["页面访问", records.data.totals.pages],
            ["出现次数", records.data.totals.occurrences],
            ["关联用户", records.data.totals.users],
          ].map(([k, n]) => (
            <div key={k}>
              <span>{copy(String(k))}</span>
              <strong>{number(Number(n))}</strong>
            </div>
          ))}
        </div>
      )}
      {records.loading ? (
        <Loading />
      ) : (
        <div className="visitor-ip-list">
          {records.data?.items.map((v) => (
            <article key={v.ip}>
              <div>
                <h3>
                  <code>{v.ip}</code>
                </h3>
                <Place value={v} />
                <p className="subtle-note">{v.source}</p>
              </div>
              <dl>
                {[
                  ["访问次数", v.page_count],
                  ["出现次数", v.occurrence_count],
                  ["关联用户", v.user_count],
                  ["预约提交", v.booking_count],
                  ["发送消息", v.message_count],
                ].map(([k, n]) => (
                  <div key={k}>
                    <dt>{copy(String(k))}</dt>
                    <dd>{number(Number(n))}</dd>
                  </div>
                ))}
              </dl>
              <div className="visitor-seen">
                <p>
                  {copy("首次访问")} · {dateTime(v.first_seen)}
                </p>
                <p>
                  {copy("最近访问")} · {dateTime(v.last_seen)}
                </p>
                <button className="text-button" onClick={() => setIP(v.ip)}>
                  {copy("查看访问明细")}
                </button>
              </div>
            </article>
          ))}
          {!records.data?.items.length && (
            <p className="form-note">{copy("暂无匹配记录")}</p>
          )}
        </div>
      )}
      <Pager
        page={page}
        total={records.data?.totals.ips || 0}
        onChange={setPage}
      />
      {ip && (
        <Modal
          title={`${copy("访问明细")} · ${ip}`}
          wide
          onClose={() => setIP("")}
        >
          <AccessHistory query={`ip=${encodeURIComponent(ip)}`} />
        </Modal>
      )}
    </div>
  );
}
