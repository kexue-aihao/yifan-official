"use client";
import { useCopy, useFormatting, useServiceTitle } from "../i18n";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "../routing";
import { X, Send, MessageCircle, ChevronLeft } from "lucide-react";
import {
  api,
  send,
  useResource,
  useSite,
  type Message,
  type Thread,
} from "../lib";
import { Empty, ErrorNotice, Loading } from "../components";

function mergeMessages(items: Message[]) {
  const cutoff = Date.now() - 180 * 86400000;
  return [
    ...new Map(
      items.filter((m) => m.created_at > cutoff).map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.created_at - b.created_at);
}

export function ConversationView({ threadId }: { threadId: string }) {
  const { dateTime } = useFormatting();
  const copy = useCopy();
  const { user, revision, live } = useSite();
  const messages = useResource<Message[]>(
    `/conversations/${threadId}/messages`,
  );
  const [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [older, setOlder] = useState<Message[]>([]),
    [hasOlder, setHasOlder] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messages.reload();
  }, [revision, messages.reload]);
  useEffect(() => {
    setOlder([]);
    setHasOlder(true);
  }, [threadId]);
  useEffect(() => {
    // Preserve loaded history when a live update shifts the latest 100-message window.
    if (messages.data)
      setOlder((current) => mergeMessages([...current, ...messages.data!]));
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [messages.data]);
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await send(`/conversations/${threadId}/messages`, { body });
      setBody("");
      messages.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadEarlier() {
    const before = older[0]?.id || messages.data?.[0]?.id;
    if (!before) return;
    try {
      const items = await api<Message[]>(
        `/conversations/${threadId}/messages?before=${before}`,
      );
      setOlder((current) => mergeMessages([...items, ...current]));
      setHasOlder(items.length === 100);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const all = mergeMessages([...older, ...(messages.data || [])]);
  return (
    <div className="conversation-view">
      <div className="chat-connection">
        <span
          className={live ? "connection-dot connected" : "connection-dot"}
        />
        {live ? copy("消息连接已建立") : copy("正在重连，发送的消息仍会保存")}
        <span>{copy("会话保留 180 天")}</span>
      </div>
      <div className="message-list">
        {messages.loading && !messages.data ? (
          <Loading />
        ) : !all.length ? (
          <Empty title={copy("从一句你好开始。")}>
            <p>{copy("说说你的想法，顾问接待后会在这里回复。")}</p>
          </Empty>
        ) : (
          <>
            {hasOlder && all.length >= 100 && (
              <button
                className="load-earlier"
                onClick={() => void loadEarlier()}
              >
                {copy("查看更早消息")}
              </button>
            )}
            {all.map((m) => (
              <div
                key={m.id}
                className={`message ${m.sender_id === user?.id ? "mine" : ""}`}
              >
                <span className="message-author">
                  {m.sender_role === "admin" ? copy("壹梵顾问") : m.sender_name}
                  <time>{dateTime(m.created_at)}</time>
                </span>
                <div className="message-bubble">{m.body}</div>
              </div>
            ))}
          </>
        )}
        <div ref={bottom} />
      </div>
      <ErrorNotice error={error || messages.error} />
      <form className="chat-composer" onSubmit={sendMessage}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder={copy("分享你的想法…")}
          aria-label={copy("消息内容")}
          rows={2}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              if (!busy) void sendMessage(e);
            }
          }}
        />
        <button
          className="button"
          disabled={busy || !body.trim()}
          aria-label={copy("发送消息")}
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

export default function Chat() {
  const copy = useCopy();
  const serviceTitle = useServiceTitle();
  const { user, setChatOpen, chatThread, revision } = useSite();
  const location = useLocation();
  const threads = useResource<Thread[]>(user ? "/conversations" : null);
  const [threadId, setThreadId] = useState(chatThread),
    [error, setError] = useState(""),
    [showList, setShowList] = useState(false);
  useEffect(() => {
    threads.reload();
  }, [revision, threads.reload]);
  useEffect(() => {
    let active = true;
    setThreadId(chatThread);
    if (user && !chatThread && user.role !== "admin")
      send<Thread>("/conversations", {})
        .then((t) => {
          if (active) {
            setThreadId(t.id);
            threads.reload();
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [user?.id, chatThread, threads.reload]);
  return (
    <aside className="chat-panel" aria-label={copy("壹梵专属顾问")}>
      <div className="chat-heading">
        <div>
          <MessageCircle size={20} strokeWidth={1.4} />
          <span>
            {copy("壹梵专属顾问")}
            <small>{copy("LET'S MAKE SOMETHING BEAUTIFUL")}</small>
          </span>
        </div>
        <button
          className="icon-button"
          onClick={() => setChatOpen(false)}
          aria-label={copy("关闭客服会话")}
        >
          <X size={20} />
        </button>
      </div>
      {!user ? (
        <div className="chat-signin">
          <span className="eyebrow">{copy("A PERSONAL CONVERSATION")}</span>
          <h3>{copy("你好，很高兴与你相遇。")}</h3>
          <p>{copy("登录后即可咨询顾问，保存你的预约沟通与每一个灵感。")}</p>
          <Link
            className="button full"
            onClick={() => setChatOpen(false)}
            to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
          >
            {copy("登录后开始会话")}
          </Link>
          <p className="form-note">{copy("你的会话记录将保留 180 天。")}</p>
        </div>
      ) : (
        <>
          <button
            className="chat-thread-toggle text-button"
            onClick={() => setShowList(!showList)}
          >
            <ChevronLeft size={15} />
            {showList ? copy("返回当前对话") : copy("全部预约与咨询会话")}
          </button>
          <ErrorNotice error={error || threads.error} />
          {showList || !threadId ? (
            <div className="thread-list">
              {threads.data?.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setThreadId(t.id);
                    setShowList(false);
                  }}
                >
                  <strong>
                    {user.role === "admin" ? `${t.customer_name} · ` : ""}
                    {t.service_title
                      ? serviceTitle(t.service_id || "", t.service_title)
                      : copy("专属顾问咨询")}
                  </strong>
                  <span>{t.last_message || copy("尚未开始对话")}</span>
                </button>
              ))}
              {!threads.data?.length && (
                <p className="form-note">
                  {user.role === "admin"
                    ? copy("还没有顾客会话，可在管理后台接待。")
                    : copy("正在为你开启会话…")}
                </p>
              )}
            </div>
          ) : (
            <ConversationView key={threadId} threadId={threadId} />
          )}
        </>
      )}
    </aside>
  );
}
