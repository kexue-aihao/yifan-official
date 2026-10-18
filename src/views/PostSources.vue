<script lang="tsx">
import { defineComponent, ref as vueRef } from "vue";
import { Empty, ErrorNotice, Loading } from "../components.vue";
import { useCopy, useFormatting } from "../i18n.vue";
import { useResource } from "../lib.vue";
type Source = {
  post_id: string;
  user_id: string;
  author: string;
  title: string | null;
  deleted: number;
  ip: string;
  fingerprint: string;
  fingerprint_version: string;
  fingerprint_quality: string;
  browser_signals: Record<string, string | number> | null;
  user_agent: string;
  accept_language: string;
  client_hints: string;
  content_hash: string;
  created_at: number;
  location: {
    country: string;
    region: string;
    city: string;
    geo_status: string;
  };
};
export const PostSourceDetails = defineComponent(
  (props: { postId?: string; label?: string }) => {
    const copy = useCopy();
    const opened = vueRef(false);
    return () => (
      <details
        class="post-trace"
        onToggle={(event) =>
          (opened.value = (event.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary>
          {copy(props.label ?? "\u53D1\u5E03\u6765\u6E90\u8FFD\u6EAF")}
        </summary>
        {opened.value && <PostSources postId={props.postId} />}
      </details>
    );
  },
  { name: "PostSourceDetails", props: ["postId", "label"] },
);
const PostSources = defineComponent(
  (props: { postId?: string }) => {
    const copy = useCopy();
    const { dateTime } = useFormatting();
    const search = vueRef("");
    const query = vueRef("");
    const page = vueRef(1);
    const resource = useResource<{
      items: Source[];
      total: number;
    }>(
      () =>
        `/admin/post-sources?page=${page.value}&search=${encodeURIComponent(query.value)}${props.postId ? `&postId=${props.postId}` : ""}`,
    );
    function filter(event: SubmitEvent) {
      event.preventDefault();
      query.value = search.value.trim();
      page.value = 1;
    }
    return () => (
      <div class="post-source-panel">
        <p class="subtle-note">
          {copy(
            "发布来源保留 180 天，完整 IP 和指纹仅管理员可见。浏览器信号可变更或伪造，仅供辅助关联。",
          )}
        </p>
        {!props.postId && (
          <form class="form source-search" onSubmit={filter}>
            <label>
              {copy("帖子 ID / 注册 ID / IP / 指纹")}
              <input
                value={search.value}
                onInput={(event) =>
                  (search.value = (event.target as HTMLInputElement).value)
                }
                maxlength={160}
              />
            </label>
            <button class="button small">{copy("搜索")}</button>
          </form>
        )}
        <ErrorNotice error={resource.error} />
        {resource.loading ? (
          <Loading />
        ) : !resource.data?.items.length ? (
          <Empty title={copy("暂无来源记录，历史帖子不会补填。")} />
        ) : (
          resource.data.items.map((source) => (
            <article class="post-source" key={source.post_id}>
              <h3>{source.title || copy("帖子已删除")}</h3>
              <time>{dateTime(source.created_at)}</time>
              <dl>
                <dt>{copy("帖子 ID")}</dt>
                <dd>
                  <code>{source.post_id}</code>
                </dd>
                <dt>{copy("注册 ID")}</dt>
                <dd>
                  <code>{source.user_id}</code> · {source.author}
                </dd>
                <dt>{copy("发布 IP")}</dt>
                <dd>
                  <code>{source.ip}</code> ·{" "}
                  {source.location.geo_status === "private"
                    ? copy("内网 / 本机")
                    : source.location.geo_status === "unknown"
                      ? copy("归属地未知")
                      : [
                          source.location.country,
                          source.location.region,
                          source.location.city,
                        ]
                          .filter(Boolean)
                          .join(" / ") || copy("归属地未知")}
                </dd>
                <dt>{copy("指纹摘要")}</dt>
                <dd>
                  <code>{source.fingerprint}</code>
                  <small>
                    {source.fingerprint_version} · {source.fingerprint_quality}
                  </small>
                </dd>
                <dt>User-Agent</dt>
                <dd>{source.user_agent || "—"}</dd>
                <dt>Accept-Language / Client Hints</dt>
                <dd>
                  {source.accept_language} / {source.client_hints || "—"}
                </dd>
                <dt>{copy("浏览器信号")}</dt>
                <dd>
                  <code>
                    {source.browser_signals
                      ? JSON.stringify(source.browser_signals)
                      : copy("未提供")}
                  </code>
                </dd>
                <dt>{copy("内容摘要")}</dt>
                <dd>
                  <code>{source.content_hash}</code>
                </dd>
              </dl>
            </article>
          ))
        )}
        {!props.postId && !!resource.data && resource.data.total > 25 && (
          <div class="pagination">
            <button
              class="text-button"
              disabled={page.value === 1}
              onClick={() => (page.value = page.value - 1)}
            >
              {copy("上一页")}
            </button>
            <span>
              {page.value} / {Math.ceil(resource.data.total / 25)}
            </span>
            <button
              class="text-button"
              disabled={page.value * 25 >= resource.data.total}
              onClick={() => (page.value = page.value + 1)}
            >
              {copy("下一页")}
            </button>
          </div>
        )}
      </div>
    );
  },
  { name: "PostSources", props: ["postId"] },
);
export default PostSources;
</script>
