"use client";
import { useCopy, useFormatting, countMessages } from "../i18n";

import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "../routing";
import { Heart, MessageCircle, PenLine, ArrowLeft, Trash2 } from "lucide-react";
import { categories, send, useResource, useSite, type Post } from "../lib";
import { Arrow, Empty, ErrorNotice, Loading, Modal } from "../components";
import {PostContent,PostSummary,browserSignals} from '../CommunityImages';
import {parseImageLinks,parsePostImages} from '../../shared/media.mjs';
import {PostSourceDetails} from './PostSources';

type PostDetail = Post & {
  liked: boolean;
  comments: { id: string; author: string; body: string; created_at: number }[];
};
export default function Community() {
  const { id } = useParams();
  return id ? <Detail key={id} id={id} /> : <Feed />;
}
function Feed() {
  const { dateTime } = useFormatting();
  const copy = useCopy();
  const { user, loading } = useSite();
  const navigate = useNavigate();
  const [category, setCategory] = useState("全部故事"),
    [page, setPage] = useState(1),
    [compose, setCompose] = useState(false);
  const posts = useResource<{ posts: Post[]; total: number; pageSize: number }>(
    `/posts?page=${page}${category !== "全部故事" ? `&category=${encodeURIComponent(category)}` : ""}`,
  );
  return (
    <div className="page container community-page">
      <div className="community-intro">
        <div>
          <span className="eyebrow">{copy("THE YI FAN COMMUNITY")}</span>
          <h1>{copy("分享美好，让灵感相遇。")}</h1>
          <p>
            {copy("婚纱灵感、拍摄日记，或一个关于 Cosplay 的奇思妙想。")}
            <br />
            {copy("关于美和热爱，我们都想听你说。")}
          </p>
        </div>
        <button
          className="button"
          disabled={loading}
          onClick={() =>
            user ? setCompose(true) : navigate("/login?next=/community")
          }
        >
          <PenLine size={17} />
          {copy("写下我的故事")}
        </button>
      </div>
      <div className="filter-tabs" role="group" aria-label={copy("帖子分类")}>
        {["全部故事", ...categories].map((c) => (
          <button
            key={c}
            className={c === category ? "active" : ""}
            aria-pressed={c === category}
            onClick={() => {
              setCategory(c);
              setPage(1);
            }}
          >
            {copy(c)}
          </button>
        ))}
      </div>
      <ErrorNotice error={posts.error} />
      {posts.loading ? (
        <Loading />
      ) : !posts.data?.posts.length ? (
        <Empty title={copy("第一篇故事，等你来写。")}>
          <p>
            {copy("分享你的灵感、期待和小小的美好，也许就会遇见同频的人。")}
          </p>
          <button
            className="button outline"
            disabled={loading}
            onClick={() =>
              user ? setCompose(true) : navigate("/login?next=/community")
            }
          >
            {copy("开始分享")}
            <Arrow />
          </button>
        </Empty>
      ) : (
        <div className="forum-feed">
          {posts.data.posts.map((p) => (
            <Link to={`/community/${p.id}`} className="forum-post" key={p.id}>
              <div className="post-avatar">{p.author.slice(0, 1)}</div>
              <div className="forum-post-body">
                <div className="post-byline">
                  <strong>{p.author}</strong>
                  <span className="post-author-id">{copy('注册 ID')} <bdi>{p.user_id}</bdi></span>
                  <time>{dateTime(p.created_at)}</time>
                  <span className="tag">{copy(p.category)}</span>
                </div>
                <h2>{p.title}</h2>
                <PostSummary body={p.body} images={p.images}/>
                <div className="post-stats">
                  <span>
                    <Heart size={15} />
                    {p.like_count}
                  </span>
                  <span>
                    <MessageCircle size={15} />
                    {copy(countMessages.replies, { count: p.comment_count })}
                  </span>
                  <span className="read-story">
                    {copy("阅读故事")}
                    <Arrow />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {!!posts.data && posts.data.total > 12 && (
        <div className="pagination">
          <button
            className="button outline small"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {copy("上一页")}
          </button>
          <span>
            {page} / {Math.ceil(posts.data.total / 12)}
          </span>
          <button
            className="button outline small"
            disabled={page * 12 >= posts.data.total}
            onClick={() => setPage(page + 1)}
          >
            {copy("下一页")}
          </button>
        </div>
      )}
      <div className="community-guidelines">
        <h3>{copy("以善意，回应每一种表达。")}</h3>
        <p>
          {copy(
            "尊重每个人的风格和选择。请发布与拍摄、美学和庆典相关的内容，避免分享联系方式等个人隐私。",
          )}
        </p>
      </div>
      {compose && (
        <Compose
          onClose={() => setCompose(false)}
          onDone={(postId) => navigate(`/community/${postId}`)}
        />
      )}
    </div>
  );
}
function Compose({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const copy = useCopy();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [imageLinks,setImageLinks] = useState(''),[body,setBody] = useState('');
  const images = parseImageLinks(imageLinks.split('\n').map(value=>value.trim()).filter(Boolean));
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const result = await send<{ id: string }>("/posts", {
        title: data.get("title"),
        category: data.get("category"),
        body: data.get("body"),
        images: imageLinks.split('\n').map(value=>value.trim()).filter(Boolean),
        browserSignals: browserSignals(),
      });
      onDone(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={copy("写下你的故事")} onClose={onClose}>
      <form className="form" onSubmit={publish}>
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
            minLength={2}
            maxLength={100}
            placeholder={copy("比如：第一次拍婚纱，想尝试自然纪实风")}
            required
          />
        </label>
        <label>
          {copy("分享内容")}
          <textarea
            name="body"
            value={body}
            onChange={event=>setBody(event.target.value)}
            minLength={5}
            maxLength={10000}
            rows={8}
            placeholder={copy(
              "一份灵感、一段经历，或者一个想听听大家意见的问题…",
            )}
            required
          />
        </label>
        <label>{copy('图片链接（每行一张，最多 9 张）')}<textarea name="images" value={imageLinks} onChange={event=>setImageLinks(event.target.value)} rows={3} maxLength={20000} placeholder="https://…" /></label>
        <p className="subtle-note">{copy('支持 HTTPS 图片直链、Markdown 和 BBCode。分享页请先复制图片原始地址。')}</p>
        {(images.length>0 || parsePostImages(body).some(part=>part.type==='image')) && <details className="post-preview" open><summary>{copy('图片预览')}</summary><PostContent body={body} images={images}/></details>}
        <p className="subtle-note">
          {copy("帖子与回复将公开展示，请保护个人隐私。")}
          {' '}{copy('作者注册 ID 公开展示；发布时记录 IP 与浏览器指纹，供管理员在 180 天内追溯。')}
        </p>
        <ErrorNotice error={error} />
        <button className="button full" disabled={busy}>
          {busy ? copy("正在发布…") : copy("发布我的故事")}
          <Arrow />
        </button>
      </form>
    </Modal>
  );
}
function Detail({ id }: { id: string }) {
  const { dateTime } = useFormatting();
  const copy = useCopy();
  const { user } = useSite();
  const navigate = useNavigate();
  const [commentPage, setCommentPage] = useState(1);
  const post = useResource<PostDetail>(`/posts/${id}?page=${commentPage}`);
  const [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  async function reply(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate(`/login?next=/community/${id}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await send(`/posts/${id}/comments`, { body });
      setBody("");
      setCommentPage(Math.ceil(((post.data?.comment_count || 0) + 1) / 50));
      post.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function like() {
    if (!user) {
      navigate(`/login?next=/community/${id}`);
      return;
    }
    setBusy(true);
    try {
      await send(`/posts/${id}/like`, {});
      post.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await send(`/posts/${id}`, {}, "DELETE");
      navigate("/community");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (post.loading && !post.data) return <Loading />;
  if (!post.data)
    return (
      <div className="page container">
        <ErrorNotice error={post.error} />
        <Link className="under-link" to="/community">
          {copy("回到社区")}
          <Arrow />
        </Link>
      </div>
    );
  const p = post.data;
  return (
    <div className="page container post-detail">
      <Link className="back-link" to="/community">
        <ArrowLeft size={17} />
        {copy("回到壹梵社区")}
      </Link>
      <article>
        <span className="tag">{copy(p.category)}</span>
        <h1>{p.title}</h1>
        <div className="post-byline">
          <div className="post-avatar">{p.author.slice(0, 1)}</div>
          <strong>{p.author}</strong>
          <span className="post-author-id">{copy('注册 ID')} <bdi>{p.user_id}</bdi></span>
          <time>{dateTime(p.created_at)}</time>
        </div>
        <PostContent body={p.body} images={p.images}/>
        {user?.role==='admin' && <PostSourceDetails postId={p.id}/>}
        <div className="post-detail-actions">
          <button
            className={`button outline small ${p.liked ? "liked" : ""}`}
            onClick={() => void like()}
            disabled={busy}
          >
            <Heart size={17} fill={p.liked ? "currentColor" : "none"} />
            {copy(countMessages.likes, { count: p.like_count })}
          </button>
          {(user?.id === p.user_id || user?.role === "admin") && (
            <button
              className="text-button"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={15} />
              {copy("删除帖子")}
            </button>
          )}
        </div>
      </article>
      <ErrorNotice error={error || post.error} />
      <section className="comments-section">
        <h2>
          {copy("聊一聊")}
          <small>
            {copy(countMessages.replies, { count: p.comment_count })}
          </small>
        </h2>
        {p.comments.map((c) => (
          <div className="comment" key={c.id}>
            <div className="post-avatar">{c.author.slice(0, 1)}</div>
            <div>
              <div className="post-byline">
                <strong>{c.author}</strong>
                <time>{dateTime(c.created_at)}</time>
              </div>
              <p>{c.body}</p>
            </div>
          </div>
        ))}
        {p.comment_count > 50 && (
          <div className="pagination">
            <button
              className="text-button"
              disabled={commentPage === 1}
              onClick={() => setCommentPage((v) => v - 1)}
            >
              {copy("上一页")}
            </button>
            <span>
              {commentPage} / {Math.ceil(p.comment_count / 50)}
            </span>
            <button
              className="text-button"
              disabled={commentPage * 50 >= p.comment_count}
              onClick={() => setCommentPage((v) => v + 1)}
            >
              {copy("下一页")}
            </button>
          </div>
        )}
        {user ? (
          <form className="form reply-form" onSubmit={reply}>
            <label>
              {copy("你的回应")}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={copy("分享你的想法，以善意开始对话…")}
                required
              />
            </label>
            <button className="button" disabled={busy || !body.trim()}>
              {busy ? copy("发送中…") : copy("发布回复")}
              <Arrow />
            </button>
          </form>
        ) : (
          <p className="info-notice">
            <Link to={`/login?next=/community/${id}`}>{copy("登录")}</Link>
            {copy("后加入这场对话。")}
          </p>
        )}
      </section>
      {confirmDelete && (
        <Modal
          title={copy("删除这篇故事？")}
          onClose={() => setConfirmDelete(false)}
        >
          <p>{copy("帖子、回复与点赞将一并删除，此操作无法撤销。")}</p>
          <ErrorNotice error={error} />
          <div className="modal-actions">
            <button
              className="button outline"
              onClick={() => setConfirmDelete(false)}
            >
              {copy("保留故事")}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void remove()}
            >
              {copy("确认删除")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
