import { ChevronLeft, MessageCircle, Send, X } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  ref as vueRef,
  watch,
} from "vue";
import { Empty, ErrorNotice, Loading } from "../components";
import { dialogOpener } from "../focus";
import { useCopy, useFormatting, useServiceTitle } from "../i18n";
import {
  api,
  send,
  useResource,
  useSite,
  type Message,
  type Thread,
} from "../lib";
import { Link, useLocation } from "../routing";
import { useVisibleReceipt } from "../useVisibleReceipt";
function mergeMessages(items: Message[]) {
  const cutoff = Date.now() - 180 * 86400000;
  return [
    ...new Map(
      items.filter((m) => m.created_at > cutoff).map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.created_at - b.created_at);
}
export const ConversationView = defineComponent(
  (props: { threadId: string; thread?: Thread }) => {
    const { dateTime } = useFormatting();
    const copy = useCopy();
    const site = useSite();
    const messages = useResource<Message[]>(
      () => `/conversations/${props.threadId}/messages`,
    );
    const body = vueRef("");
    const error = vueRef("");
    const busy = vueRef(false);
    const loadingEarlier = vueRef(false);
    const older = vueRef<Message[]>([]);
    const hasOlder = vueRef(true);
    const readReceipts = vueRef<Record<string, number>>({});
    const messageList = shallowRef<HTMLDivElement | null>(null);
    let followLatest = true;
    const trackScroll = () => {
      const list = messageList.value;
      if (list)
        followLatest =
          list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    };
    const acknowledged = shallowRef(new Set<string>());
    const pendingReads = shallowRef(new Set<string>());
    const latestMessage = shallowRef<string | undefined>(undefined);
    const acknowledge = (elements: HTMLElement[]) => {
      const ids = elements
        .map((el) => el.dataset.receiptId!)
        .filter(
          (id) => !acknowledged.value.has(id) && !pendingReads.value.has(id),
        )
        .slice(0, 100);
      if (!ids.length) return;
      ids.forEach((id) => pendingReads.value.add(id));
      void send<{
        receipts: {
          id: string;
          staff_read_at: number;
        }[];
      }>(`/conversations/${props.threadId}/read`, { messageIds: ids })
        .then(({ receipts }) => {
          receipts.forEach((r) => acknowledged.value.add(r.id));
          error.value = "";
          messages.reload();
        })
        .catch((e) => (error.value = e.message))
        .finally(() => {
          ids.forEach((id) => pendingReads.value.delete(id));
        });
    };
    useVisibleReceipt(
      messageList,
      () => site.user?.role === "admin" && !!messages.data && !messages.loading,
      acknowledge,
    );
    onMounted(() => {
      watch(
        () => [site.revision, messages.reload],
        () => {
          messages.reload();
        },
        { immediate: true, flush: "post" },
      );
    });
    onMounted(() => {
      watch(
        () => [props.threadId],
        (_next, _previous, onCleanup) => {
          const receive = (event: Event) => {
            const data = (event as CustomEvent).detail;
            if (
              data.type !== "messages-read" ||
              data.conversationId !== props.threadId
            )
              return;
            readReceipts.value = ((current) => ({
              ...current,
              ...Object.fromEntries(
                data.receipts.map(
                  (r: { id: string; staff_read_at: number }) => [
                    r.id,
                    r.staff_read_at,
                  ],
                ),
              ),
            }))(readReceipts.value);
          };
          window.addEventListener("yifan-update", receive);
          onCleanup(() => window.removeEventListener("yifan-update", receive));
        },
        { immediate: true, flush: "post" },
      );
    });
    onMounted(() => {
      watch(
        () => [props.threadId],
        () => {
          older.value = [];
          hasOlder.value = true;
        },
        { immediate: true, flush: "post" },
      );
    });
    onMounted(() => {
      watch(
        () => [messages.data],
        () => {
          // Preserve loaded history when a live update shifts the latest 100-message window.
          if (messages.data)
            older.value = ((current) =>
              mergeMessages([...current, ...messages.data!]))(older.value);
          const newest = messages.data?.at(-1)?.id;
          if (
            newest &&
            newest !== latestMessage.value &&
            (followLatest || messages.data?.at(-1)?.sender_id === site.user?.id)
          ) {
            void nextTick(() => {
              const list = messageList.value;
              if (list) list.scrollTop = list.scrollHeight;
            });
          }
          latestMessage.value = newest;
        },
        { immediate: true, flush: "post" },
      );
    });
    async function sendMessage(e: Event) {
      e.preventDefault();
      if (busy.value || !body.value.trim()) return;
      const sentBody = body.value;
      busy.value = true;
      error.value = "";
      try {
        await send(`/conversations/${props.threadId}/messages`, {
          body: sentBody,
        });
        // A slow response must not erase the next message being drafted.
        if (body.value === sentBody) body.value = "";
        messages.reload();
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        busy.value = false;
      }
    }
    async function loadEarlier() {
      const before = older.value[0]?.id || messages.data?.[0]?.id;
      if (!before || loadingEarlier.value) return;
      loadingEarlier.value = true;
      error.value = "";
      try {
        const items = await api<Message[]>(
          `/conversations/${props.threadId}/messages?before=${before}`,
        );
        const list = messageList.value;
        const anchor = list?.querySelector<HTMLElement>(".message");
        const anchorTop = anchor?.getBoundingClientRect().top;
        older.value = ((current) => mergeMessages([...items, ...current]))(
          older.value,
        );
        hasOlder.value = items.length === 100;
        await nextTick();
        // Respect native scroll anchoring; correct only the remaining offset.
        if (list && anchor?.isConnected && anchorTop !== undefined)
          list.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        loadingEarlier.value = false;
      }
    }
    const all = computed(() =>
      mergeMessages([...older.value, ...(messages.data || [])]),
    );
    return () => (
      <div class="conversation-view">
        <div class="chat-connection">
          <span
            class={site.live ? "connection-dot connected" : "connection-dot"}
          />
          {site.live
            ? copy("消息连接已建立")
            : copy("正在重连，发送的消息仍会保存")}
          <span>{copy("会话保留 180 天")}</span>
        </div>
        {props.thread?.assignee_name && (
          <div class="conversation-assignee">
            {copy("当前接待")}：{props.thread.assignee_name}
            {props.thread.assignee_title
              ? ` · ${props.thread.assignee_title}`
              : ""}
          </div>
        )}
        <div class="message-list" ref={messageList} onScroll={trackScroll}>
          {messages.loading && !messages.data ? (
            <Loading />
          ) : !all.value.length ? (
            <Empty title={copy("从一句你好开始。")}>
              <p>{copy("说说你的想法，顾问接待后会在这里回复。")}</p>
            </Empty>
          ) : (
            <>
              {hasOlder.value && all.value.length >= 100 && (
                <button
                  class="load-earlier"
                  disabled={loadingEarlier.value}
                  aria-busy={loadingEarlier.value}
                  onClick={() => void loadEarlier()}
                >
                  {copy(loadingEarlier.value ? "正在加载…" : "查看更早消息")}
                </button>
              )}
              {all.value.map((m) => (
                <div
                  key={m.id}
                  class={`message ${m.sender_id === site.user?.id ? "mine" : ""}`}
                >
                  <span class="message-author">
                    {m.sender_name ||
                      (m.sender_role === "admin" ? copy("壹梵顾问") : "")}
                    {m.sender_title ? ` · ${m.sender_title}` : ""}
                    <time>{dateTime(m.created_at)}</time>
                  </span>
                  <div
                    class="message-bubble"
                    data-receipt-id={
                      site.user?.role === "admin" &&
                      m.sender_role === "customer" &&
                      !m.staff_read_at
                        ? m.id
                        : undefined
                    }
                  >
                    {m.body}
                  </div>
                  {m.sender_id === site.user?.id &&
                    site.user?.role === "customer" && (
                      <span
                        class={
                          m.staff_read_at || readReceipts.value[m.id]
                            ? "message-receipt read"
                            : "message-receipt"
                        }
                        title={
                          m.staff_read_at || readReceipts.value[m.id]
                            ? dateTime(
                                m.staff_read_at || readReceipts.value[m.id],
                              )
                            : undefined
                        }
                      >
                        {m.staff_read_at || readReceipts.value[m.id]
                          ? copy("工作人员已读")
                          : copy("已发送")}
                      </span>
                    )}
                </div>
              ))}
            </>
          )}
        </div>
        <ErrorNotice error={error.value || messages.error} />
        <form class="chat-composer" onSubmit={sendMessage}>
          <textarea
            value={body.value}
            onInput={(e) => (body.value = (e.target as HTMLInputElement).value)}
            maxlength={2000}
            placeholder={copy("分享你的想法…")}
            aria-label={copy("消息内容")}
            rows={2}
            onKeydown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                if (!busy.value) void sendMessage(e);
              }
            }}
          />
          <button
            class="button"
            disabled={busy.value || !body.value.trim()}
            aria-label={copy("发送消息")}
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    );
  },
  { name: "ConversationView", props: ["threadId", "thread"] },
);
const Chat = defineComponent(
  () => {
    const copy = useCopy();
    const serviceTitle = useServiceTitle();
    const site = useSite();
    const location = useLocation();
    const threads = useResource<Thread[]>(() =>
      site.user ? "/conversations" : null,
    );
    const threadId = vueRef(site.chatThread);
    const error = vueRef("");
    const showList = vueRef(false);
    const panel = shallowRef<HTMLElement | null>(null);
    let opener: HTMLElement | null = null;
    onMounted(() => {
      opener = dialogOpener();
      panel.value
        ?.querySelector<HTMLButtonElement>(".chat-heading button")
        ?.focus({
          preventScroll: true,
        });
    });
    onBeforeUnmount(() => {
      if (panel.value?.contains(document.activeElement) && opener?.isConnected)
        opener.focus({ preventScroll: true });
    });
    onMounted(() => {
      watch(
        () => [site.revision, threads.reload],
        () => {
          threads.reload();
        },
        { immediate: true, flush: "post" },
      );
    });
    onMounted(() => {
      watch(
        () => [site.user?.id, site.chatThread, threads.reload],
        (_next, _previous, onCleanup) => {
          let active = true;
          threadId.value = site.chatThread;
          if (site.user && !site.chatThread && site.user.role !== "admin")
            send<Thread>("/conversations", {})
              .then((t) => {
                if (active) {
                  threadId.value = t.id;
                  threads.reload();
                }
              })
              .catch((e) => {
                if (active) error.value = e.message;
              });
          onCleanup(() => {
            active = false;
          });
        },
        { immediate: true, flush: "post" },
      );
    });
    return () => (
      <aside
        id="chat-panel"
        class="chat-panel"
        ref={panel}
        aria-label={copy("壹梵专属顾问")}
        onKeydown={(event) => {
          if (
            event.key === "Escape" &&
            !event.isComposing &&
            !event.defaultPrevented
          ) {
            event.preventDefault();
            event.stopPropagation();
            site.setChatOpen(false);
          }
        }}
      >
        <div class="chat-heading">
          <div>
            <MessageCircle size={20} strokeWidth={1.4} />
            <span>
              {copy("壹梵专属顾问")}
              <small>{copy("LET'S MAKE SOMETHING BEAUTIFUL")}</small>
            </span>
          </div>
          <button
            class="icon-button"
            onClick={() => site.setChatOpen(false)}
            aria-label={copy("关闭客服会话")}
          >
            <X size={20} />
          </button>
        </div>
        {!site.user ? (
          <div class="chat-signin">
            <span class="eyebrow">{copy("A PERSONAL CONVERSATION")}</span>
            <h3>{copy("你好，很高兴与你相遇。")}</h3>
            <p>{copy("登录后即可咨询顾问，保存你的预约沟通与每一个灵感。")}</p>
            <Link
              class="button full"
              onClick={() => site.setChatOpen(false)}
              to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
            >
              {copy("登录后开始会话")}
            </Link>
            <p class="form-note">{copy("你的会话记录将保留 180 天。")}</p>
          </div>
        ) : (
          <>
            <button
              class="chat-thread-toggle text-button"
              onClick={() => (showList.value = !showList.value)}
            >
              <ChevronLeft size={15} />
              {showList.value
                ? copy("返回当前对话")
                : copy("全部预约与咨询会话")}
            </button>
            <ErrorNotice error={error.value || threads.error} />
            {showList.value || !threadId.value ? (
              <div class="thread-list">
                {threads.data?.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      threadId.value = t.id;
                      showList.value = false;
                    }}
                  >
                    <strong>
                      {site.user?.role === "admin"
                        ? `${t.customer_name} · `
                        : ""}
                      {t.service_title
                        ? serviceTitle(t.service_id || "", t.service_title)
                        : copy("专属顾问咨询")}
                    </strong>
                    <span>{t.last_message || copy("尚未开始对话")}</span>
                  </button>
                ))}
                {!threads.data?.length && (
                  <p class="form-note">
                    {site.user.role === "admin"
                      ? copy("还没有顾客会话，可在管理后台接待。")
                      : copy("正在为你开启会话…")}
                  </p>
                )}
              </div>
            ) : (
              <ConversationView
                key={threadId.value}
                threadId={threadId.value}
                thread={threads.data?.find((t) => t.id === threadId.value)}
              />
            )}
          </>
        )}
      </aside>
    );
  },
  { name: "Chat", props: [] },
);
export default Chat;
