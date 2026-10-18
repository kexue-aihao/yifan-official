<script lang="tsx">
import {
  ArrowLeft,
  Eye,
  Heart,
  LoaderCircle,
  MessageCircle,
  PenLine,
  Trash2,
} from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref as vueRef,
  watch,
  Transition,
} from "vue";
import { parseImageLinks, parsePostImages } from "../../shared/media.mjs";
import { PostContent, PostSummary, browserSignals } from "../CommunityImages.vue";
import { Arrow, Empty, ErrorNotice, Loading, Modal } from "../components.vue";
import { countMessages, useCopy, useFormatting } from "../i18n.vue";
import { categories, send, useResource, useSite, type Post } from "../lib.vue";
import { FilterTabs } from "../motion.vue";
import { Link, useNavigate, useParams } from "../routing.vue";
import { PostSourceDetails } from "./PostSources.vue";
type PostDetail = Post & {
  liked: boolean;
  comments: {
    id: string;
    author: string;
    body: string;
    created_at: number;
  }[];
};
const Community = defineComponent(
  () => {
    const routeParams = useParams();
    return () =>
      routeParams.id ? (
        <Detail key={routeParams.id} id={routeParams.id} />
      ) : (
        <Feed />
      );
  },
  { name: "Community", props: [] },
);
export default Community;
const Feed = defineComponent(
  () => {
    const { dateTime } = useFormatting();
    const copy = useCopy();
    const site = useSite();
    const navigate = useNavigate();
    const category = vueRef("全部故事");
    const page = vueRef(1);
    const compose = vueRef(false);
    const posts = useResource<{
      posts: Post[];
      total: number;
      pageSize: number;
    }>(
      () =>
        `/posts?page=${page.value}${category.value !== "全部故事" ? `&category=${encodeURIComponent(category.value)}` : ""}`,
    );
    return () => (
      <div class="page container community-page">
        <div class="community-intro">
          <div>
            <span class="eyebrow">{copy("THE YI FAN COMMUNITY")}</span>
            <h1>{copy("分享美好，让灵感相遇。")}</h1>
            <p>
              {copy("婚纱灵感、拍摄日记，或一个关于 Cosplay 的奇思妙想。")}
              <br />
              {copy("关于美和热爱，我们都想听你说。")}
            </p>
          </div>
          <button
            class="button"
            disabled={site.loading}
            onClick={() =>
              site.user
                ? (compose.value = true)
                : navigate("/login?next=/community")
            }
          >
            <PenLine size={17} />
            {copy("写下我的故事")}
          </button>
        </div>
        <FilterTabs
          items={["全部故事", ...categories]}
          value={category.value}
          label={copy("帖子分类")}
          onChange={(value) => {
            category.value = value;
            page.value = 1;
          }}
        />
        <ErrorNotice error={posts.error} />
        <div class="feed-results" aria-busy={posts.loading}>
          {posts.loading && posts.data && (
            <div
              class="feed-refresh"
              role="status"
              aria-label={copy("正在加载…")}
            >
              <LoaderCircle class="spin" size={18} />
            </div>
          )}
          <Transition name="content-flow" mode="out-in">
            {posts.loading && !posts.data ? (
              <Loading key="loading" />
            ) : posts.error && !posts.data ? (
              <div key="error">
                <button class="button outline" onClick={() => posts.reload()}>
                  {copy("重新连接")}
                </button>
              </div>
            ) : !posts.data?.posts.length ? (
              <Empty title={copy("第一篇故事，等你来写。")}>
                <p>
                  {copy(
                    "分享你的灵感、期待和小小的美好，也许就会遇见同频的人。",
                  )}
                </p>
                <button
                  class="button outline"
                  disabled={site.loading}
                  onClick={() =>
                    site.user
                      ? (compose.value = true)
                      : navigate("/login?next=/community")
                  }
                >
                  {copy("开始分享")}
                  <Arrow />
                </button>
              </Empty>
            ) : (
              <div
                class="forum-feed"
                key={posts.data.posts.map((post) => post.id).join(":")}
              >
                {posts.data.posts.map((p) => (
                  <Link to={`/community/${p.id}`} class="forum-post" key={p.id}>
                    <div class="post-avatar">{p.author.slice(0, 1)}</div>
                    <div class="forum-post-body">
                      <div class="post-byline">
                        <strong>{p.author}</strong>
                        <span class="post-author-id">
                          {copy("注册 ID")} <bdi>{p.user_id}</bdi>
                        </span>
                        <time>{dateTime(p.created_at)}</time>
                        <span class="tag">{copy(p.category)}</span>
                      </div>
                      <h2>{p.title}</h2>
                      <PostSummary body={p.body} images={p.images} />
                      <div class="post-stats">
                        <span class="post-views">
                          <Eye size={15} aria-hidden="true" />
                          {copy(countMessages.views, { count: p.view_count })}
                        </span>
                        <span>
                          <Heart size={15} />
                          {p.like_count}
                        </span>
                        <span>
                          <MessageCircle size={15} />
                          {copy(countMessages.replies, {
                            count: p.comment_count,
                          })}
                        </span>
                        <span class="read-story">
                          {copy("阅读故事")}
                          <Arrow />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Transition>
        </div>
        {!!posts.data && posts.data.total > 12 && (
          <div class="pagination">
            <button
              class="button outline small"
              disabled={page.value === 1}
              onClick={() => (page.value = page.value - 1)}
            >
              {copy("上一页")}
            </button>
            <span>
              {page.value} / {Math.ceil(posts.data.total / 12)}
            </span>
            <button
              class="button outline small"
              disabled={page.value * 12 >= posts.data.total}
              onClick={() => (page.value = page.value + 1)}
            >
              {copy("下一页")}
            </button>
          </div>
        )}
        <div class="community-guidelines">
          <h3>{copy("以善意，回应每一种表达。")}</h3>
          <p>
            {copy(
              "尊重每个人的风格和选择。请发布与拍摄、美学和庆典相关的内容，避免分享联系方式等个人隐私。",
            )}
          </p>
        </div>
        {compose.value && (
          <Compose
            onClose={() => (compose.value = false)}
            onDone={(postId) => navigate(`/community/${postId}`)}
          />
        )}
      </div>
    );
  },
  { name: "Feed", props: [] },
);
const Compose = defineComponent(
  (props: { onClose: () => void; onDone: (id: string) => void }) => {
    const copy = useCopy();
    const error = vueRef("");
    const busy = vueRef(false);
    const imageLinks = vueRef("");
    const body = vueRef("");
    const images = computed(() =>
      parseImageLinks(
        imageLinks.value
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
    async function publish(e: SubmitEvent) {
      e.preventDefault();
      const data = new FormData(e.currentTarget as HTMLFormElement);
      busy.value = true;
      try {
        const result = await send<{
          id: string;
        }>("/posts", {
          title: data.get("title"),
          category: data.get("category"),
          body: data.get("body"),
          images: imageLinks.value
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          browserSignals: browserSignals(),
        });
        props.onDone(result.id);
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    return () => (
      <Modal title={copy("写下你的故事")} onClose={props.onClose}>
        <form class="form" onSubmit={publish}>
          <label>
            {copy("故事分类")}
            <select name="category">
              {categories.map((c) => (
                <option key={c} value={c}>
                  {copy(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy("给故事一个标题")}
            <input
              name="title"
              minlength={2}
              maxlength={100}
              placeholder={copy("比如：第一次拍婚纱，想尝试自然纪实风")}
              required
            />
          </label>
          <label>
            {copy("分享内容")}
            <textarea
              name="body"
              value={body.value}
              onInput={(event) =>
                (body.value = (event.target as HTMLInputElement).value)
              }
              minlength={5}
              maxlength={10000}
              rows={8}
              placeholder={copy(
                "一份灵感、一段经历，或者一个想听听大家意见的问题…",
              )}
              required
            />
          </label>
          <label>
            {copy("图片链接（每行一张，最多 9 张）")}
            <textarea
              name="images"
              value={imageLinks.value}
              onInput={(event) =>
                (imageLinks.value = (event.target as HTMLInputElement).value)
              }
              rows={3}
              maxlength={20000}
              placeholder="https://…"
            />
          </label>
          <p class="subtle-note">
            {copy(
              "支持 HTTPS 图片直链、Markdown 和 BBCode。分享页请先复制图片原始地址。",
            )}
          </p>
          {(images.value.length > 0 ||
            parsePostImages(body.value).some(
              (part) => part.type === "image",
            )) && (
            <details class="post-preview" open>
              <summary>{copy("图片预览")}</summary>
              <PostContent body={body.value} images={images.value} />
            </details>
          )}
          <p class="subtle-note">
            {copy("帖子与回复将公开展示，请保护个人隐私。")}{" "}
            {copy(
              "作者注册 ID 公开展示；发布时记录 IP 与浏览器指纹，供管理员在 180 天内追溯。",
            )}
          </p>
          <ErrorNotice error={error.value} />
          <button class="button full" disabled={busy.value}>
            {busy.value ? copy("正在发布…") : copy("发布我的故事")}
            <Arrow />
          </button>
        </form>
      </Modal>
    );
  },
  { name: "Compose", props: ["onClose", "onDone"] },
);
const Detail = defineComponent(
  (props: { id: string }) => {
    const { dateTime } = useFormatting();
    const copy = useCopy();
    const site = useSite();
    const navigate = useNavigate();
    const commentPage = vueRef(1);
    const post = useResource<PostDetail>(
      () => `/posts/${props.id}?page=${commentPage.value}`,
    );
    const body = vueRef("");
    const error = vueRef("");
    const busy = vueRef(false);
    const confirmDelete = vueRef(false);
    const viewCount = vueRef(0);
    let eventId: string | undefined;
    let counted = false;
    let recording = false;
    async function recordView() {
      if (counted || recording || site.loading || !post.data || document.hidden)
        return;
      recording = true;
      eventId ??= crypto.randomUUID();
      try {
        const result = await send<{ view_count: number }>(
          `/posts/${props.id}/views`,
          { eventId },
        );
        viewCount.value = result.view_count;
        counted = true;
      } catch {
        // A failed count must not prevent reading. Later resource/visibility/online
        // events can retry the same ID without counting this opening twice.
      } finally {
        recording = false;
      }
    }
    onMounted(() => {
      watch(() => [post.data, site.loading], recordView, {
        immediate: true,
        flush: "post",
      });
      document.addEventListener("visibilitychange", recordView);
      window.addEventListener("online", recordView);
    });
    onBeforeUnmount(() => {
      document.removeEventListener("visibilitychange", recordView);
      window.removeEventListener("online", recordView);
    });
    async function reply(e: SubmitEvent) {
      e.preventDefault();
      if (!site.user) {
        navigate(`/login?next=/community/${props.id}`);
        return;
      }
      busy.value = true;
      error.value = "";
      try {
        await send(`/posts/${props.id}/comments`, { body: body.value });
        body.value = "";
        commentPage.value = Math.ceil(
          ((post.data?.comment_count || 0) + 1) / 50,
        );
        post.reload();
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    async function like() {
      if (!site.user) {
        navigate(`/login?next=/community/${props.id}`);
        return;
      }
      busy.value = true;
      try {
        await send(`/posts/${props.id}/like`, {});
        post.reload();
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    async function remove() {
      busy.value = true;
      try {
        await send(`/posts/${props.id}`, {}, "DELETE");
        navigate("/community");
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    return () => {
      if (post.loading && !post.data) return <Loading />;
      if (!post.data)
        return (
          <div class="page container">
            <ErrorNotice error={post.error} />
            <Link class="under-link" to="/community">
              {copy("回到社区")}
              <Arrow />
            </Link>
          </div>
        );
      const p = post.data;
      return (
        <div class="page container post-detail">
          <Link class="back-link" to="/community">
            <ArrowLeft size={17} />
            {copy("回到壹梵社区")}
          </Link>
          <article>
            <span class="tag">{copy(p.category)}</span>
            <h1>{p.title}</h1>
            <div class="post-byline">
              <div class="post-avatar">{p.author.slice(0, 1)}</div>
              <strong>{p.author}</strong>
              <span class="post-author-id">
                {copy("注册 ID")} <bdi>{p.user_id}</bdi>
              </span>
              <time>{dateTime(p.created_at)}</time>
              <span class="post-views">
                <Eye size={15} aria-hidden="true" />
                {copy(countMessages.views, {
                  count: Math.max(p.view_count, viewCount.value),
                })}
              </span>
            </div>
            <PostContent body={p.body} images={p.images} />
            {site.user?.role === "admin" && <PostSourceDetails postId={p.id} />}
            <div class="post-detail-actions">
              <button
                class={`button outline small ${p.liked ? "liked" : ""}`}
                onClick={() => void like()}
                disabled={busy.value}
              >
                <Heart size={17} fill={p.liked ? "currentColor" : "none"} />
                {copy(countMessages.likes, { count: p.like_count })}
              </button>
              {(site.user?.id === p.user_id || site.user?.role === "admin") && (
                <button
                  class="text-button"
                  onClick={() => (confirmDelete.value = true)}
                >
                  <Trash2 size={15} />
                  {copy("删除帖子")}
                </button>
              )}
            </div>
          </article>
          <ErrorNotice error={error.value || post.error} />
          <section class="comments-section">
            <h2>
              {copy("聊一聊")}
              <small>
                {copy(countMessages.replies, { count: p.comment_count })}
              </small>
            </h2>
            {p.comments.map((c) => (
              <div class="comment" key={c.id}>
                <div class="post-avatar">{c.author.slice(0, 1)}</div>
                <div>
                  <div class="post-byline">
                    <strong>{c.author}</strong>
                    <time>{dateTime(c.created_at)}</time>
                  </div>
                  <p>{c.body}</p>
                </div>
              </div>
            ))}
            {p.comment_count > 50 && (
              <div class="pagination">
                <button
                  class="text-button"
                  disabled={commentPage.value === 1}
                  onClick={() =>
                    (commentPage.value = ((v) => v - 1)(commentPage.value))
                  }
                >
                  {copy("上一页")}
                </button>
                <span>
                  {commentPage.value} / {Math.ceil(p.comment_count / 50)}
                </span>
                <button
                  class="text-button"
                  disabled={commentPage.value * 50 >= p.comment_count}
                  onClick={() =>
                    (commentPage.value = ((v) => v + 1)(commentPage.value))
                  }
                >
                  {copy("下一页")}
                </button>
              </div>
            )}
            {site.user ? (
              <form class="form reply-form" onSubmit={reply}>
                <label>
                  {copy("你的回应")}
                  <textarea
                    value={body.value}
                    onInput={(e) =>
                      (body.value = (e.target as HTMLInputElement).value)
                    }
                    rows={3}
                    maxlength={2000}
                    placeholder={copy("分享你的想法，以善意开始对话…")}
                    required
                  />
                </label>
                <button
                  class="button"
                  disabled={busy.value || !body.value.trim()}
                >
                  {busy.value ? copy("发送中…") : copy("发布回复")}
                  <Arrow />
                </button>
              </form>
            ) : (
              <p class="info-notice">
                <Link to={`/login?next=/community/${props.id}`}>
                  {copy("登录")}
                </Link>
                {copy("后加入这场对话。")}
              </p>
            )}
          </section>
          {confirmDelete.value && (
            <Modal
              title={copy("删除这篇故事？")}
              onClose={() => (confirmDelete.value = false)}
            >
              <p>{copy("帖子、回复与点赞将一并删除，此操作无法撤销。")}</p>
              <ErrorNotice error={error.value} />
              <div class="modal-actions">
                <button
                  class="button outline"
                  onClick={() => (confirmDelete.value = false)}
                >
                  {copy("保留故事")}
                </button>
                <button
                  class="button"
                  disabled={busy.value}
                  onClick={() => void remove()}
                >
                  {copy("确认删除")}
                </button>
              </div>
            </Modal>
          )}
        </div>
      );
    };
  },
  { name: "Detail", props: ["id"] },
);
</script>
