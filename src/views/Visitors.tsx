import { defineComponent, ref as vueRef } from "vue";
import { ErrorNotice, Loading, Modal } from "../components";
import { useCopy, useFormatting, useLocale } from "../i18n";
import { useResource } from "../lib";
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
const Place = defineComponent(
  (props: { value: Location }) => {
    const copy = useCopy();
    const locale = useLocale();
    return () => {
      let country = props.value.country;
      try {
        if (country)
          country =
            new Intl.DisplayNames([locale.value], { type: "region" }).of(
              country,
            ) || country;
      } catch {}
      return (
        <span title={props.value.source}>
          {props.value.geo_status === "private"
            ? copy("内网 / 本机")
            : props.value.geo_status === "unknown"
              ? copy("归属地未知")
              : [country, props.value.region, props.value.city]
                  .filter(Boolean)
                  .join(" · ") || copy("归属地未知")}
        </span>
      );
    };
  },
  { name: "Place", props: ["value"] },
);
const Pager = defineComponent(
  (props: { page: number; total: number; onChange: (p: number) => void }) => {
    const copy = useCopy();
    return () => (
      <div class="visitor-pager">
        <button
          class="button outline small"
          disabled={props.page <= 1}
          onClick={() => props.onChange(props.page - 1)}
        >
          {copy("上一页")}
        </button>
        <span>
          {props.page} / {Math.max(1, Math.ceil(props.total / 25))}
        </span>
        <button
          class="button outline small"
          disabled={props.page * 25 >= props.total}
          onClick={() => props.onChange(props.page + 1)}
        >
          {copy("下一页")}
        </button>
      </div>
    );
  },
  { name: "Pager", props: ["page", "total", "onChange"] },
);
export const AccessHistory = defineComponent(
  (props: { query: string }) => {
    const copy = useCopy();
    const { dateTime } = useFormatting();
    const page = vueRef(1);
    const records = useResource<{
      items: Visit[];
      total: number;
    }>(() => `/admin/visitor-events?${props.query}&page=${page.value}`);
    return () => (
      <div class="access-history">
        <ErrorNotice error={records.error} />
        {records.loading ? (
          <Loading />
        ) : !records.data?.items.length ? (
          <p class="form-note">{copy("暂无访问记录，历史 IP 不会补填。")}</p>
        ) : (
          <>
            <div class="visitor-event-list">
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
            <Pager
              page={page.value}
              total={records.data.total}
              onChange={(__value) => {
                page.value = __value;
              }}
            />
          </>
        )}
      </div>
    );
  },
  { name: "AccessHistory", props: ["query"] },
);
const Visitors = defineComponent(
  () => {
    const copy = useCopy();
    const { dateTime, number } = useFormatting();
    const search = vueRef("");
    const page = vueRef(1);
    const ip = vueRef("");
    const records = useResource<{
      items: IP[];
      totals: {
        ips: number;
        occurrences: number;
        pages: number;
        users: number;
      };
    }>(
      () =>
        `/admin/visitors?search=${encodeURIComponent(search.value)}&page=${page.value}`,
    );
    function submit(e: SubmitEvent) {
      e.preventDefault();
      search.value = String(
        new FormData(e.currentTarget as HTMLFormElement).get("search") || "",
      ).trim();
      page.value = 1;
    }
    return () => (
      <div class="visitor-panel">
        <p class="form-note">
          {copy(
            "保留最近 180 天。访问次数仅计页面访问；出现次数包含注册、登录、预约与会话操作。归属地为 IP 数据库估算。",
          )}
        </p>
        <form class="visitor-search" onSubmit={submit}>
          <label>
            {copy("IP / 注册 ID / 邮箱 / 称呼")}
            <input
              name="search"
              maxlength={160}
              placeholder={copy("输入完整值搜索")}
            />
          </label>
          <button class="button small">{copy("搜索")}</button>
          <button
            type="button"
            class="button outline small"
            onClick={() => records.reload()}
          >
            {copy("刷新记录")}
          </button>
        </form>
        <ErrorNotice error={records.error} />
        {records.data && (
          <div class="stats-grid">
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
          <div class="visitor-ip-list">
            {records.data?.items.map((v) => (
              <article key={v.ip}>
                <div>
                  <h3>
                    <code>{v.ip}</code>
                  </h3>
                  <Place value={v} />
                  <p class="subtle-note">{v.source}</p>
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
                <div class="visitor-seen">
                  <p>
                    {copy("首次访问")} · {dateTime(v.first_seen)}
                  </p>
                  <p>
                    {copy("最近访问")} · {dateTime(v.last_seen)}
                  </p>
                  <button class="text-button" onClick={() => (ip.value = v.ip)}>
                    {copy("查看访问明细")}
                  </button>
                </div>
              </article>
            ))}
            {!records.data?.items.length && (
              <p class="form-note">{copy("暂无匹配记录")}</p>
            )}
          </div>
        )}
        <Pager
          page={page.value}
          total={records.data?.totals.ips || 0}
          onChange={(__value) => {
            page.value = __value;
          }}
        />
        {ip.value && (
          <Modal
            title={`${copy("访问明细")} · ${ip.value}`}
            wide
            onClose={() => (ip.value = "")}
          >
            <AccessHistory query={`ip=${encodeURIComponent(ip.value)}`} />
          </Modal>
        )}
      </div>
    );
  },
  { name: "Visitors", props: [] },
);
export default Visitors;
