<script lang="tsx">
import { CalendarDays, ShieldCheck } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onMounted,
  ref as vueRef,
  watch,
} from "vue";
import ConsentText from "../ConsentText.vue";
import { SiteImage } from "../MediaProvider.vue";
import { useTheme } from "../ThemeProvider.vue";
import { Arrow, ErrorNotice, Loading, Modal } from "../components.vue";
import { countMessages, useCopy, useFormatting } from "../i18n.vue";
import {
  chinaDate,
  send,
  useResource,
  useSite,
  type Booking,
  type Service,
} from "../lib.vue";
import { FilterTabs } from "../motion.vue";
import { useNavigate, useSearchParams } from "../routing.vue";
import ServiceLayouts from "./ServiceLayouts.vue";
const Services = defineComponent(
  () => {
    const appearance = useTheme();
    const copy = useCopy();
    const site = useSite();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const selected = vueRef<Service | null>(null);
    const filter = vueRef(params.value.get("category") || "全部服务");
    onMounted(() => {
      watch(
        () => [params.value, site.services, site.user],
        () => {
          const service = site.services.find(
            (s) => s.id === params.value.get("book"),
          );
          if (service && site.user) selected.value = service;
        },
        { immediate: true, flush: "post" },
      );
    });
    function book(service: Service) {
      if (!site.user) {
        navigate(
          `/login?next=${encodeURIComponent(`/services?book=${service.id}`)}`,
        );
        return;
      }
      selected.value = service;
    }
    const filters = computed(() => [
      "全部服务",
      ...new Set(site.services.map((s) => s.category)),
    ]);
    return () => (
      <div class={`page services-page container services-${appearance.theme}`}>
        <div class="page-title">
          <span class="eyebrow">{copy("MADE FOR YOU, AND ONLY YOU")}</span>
          <h1>{copy("你的美好，专属定制。")}</h1>
          <p>
            {copy("从婚纱影像到个人表达，从重要庆典到日常心动。")}
            <br />
            {copy("用恰到好处的仪式感，回应独一无二的你。")}
          </p>
        </div>
        <FilterTabs
          items={filters.value}
          value={filter.value}
          onChange={(__value) => {
            filter.value = __value;
          }}
          label={copy("服务分类")}
        />
        {site.settings?.site.samplePricing && (
          <p class="subtle-note">
            {copy("当前展示示例套餐与价格，正式方案及报价请与顾问沟通确认。")}
          </p>
        )}
        <ServiceLayouts
          services={site.services.filter(
            (s) => filter.value === "全部服务" || s.category === filter.value,
          )}
          book={book}
          enabled={!!site.settings?.booking.enabled}
        />
        {!site.services.length && <Loading />}
        <div class="service-assurance">
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
        {selected.value && (
          <BookingModal
            service={selected.value}
            onClose={() => {
              selected.value = null;
              if (params.value.has("book")) {
                params.value.delete("book");
                setParams(params.value, { replace: true });
              }
            }}
          />
        )}
      </div>
    );
  },
  { name: "Services", props: [] },
);
export default Services;
const BookingModal = defineComponent(
  (props: { service: Service; onClose: () => void }) => {
    const { money } = useFormatting();
    const copy = useCopy();
    const site = useSite();
    const navigate = useNavigate();
    const day = vueRef(chinaDate(site.settings?.booking.minAdvanceDays || 1));
    const time = vueRef("");
    const error = vueRef("");
    const busy = vueRef(false);
    const key = vueRef((() => crypto.randomUUID())());
    const slots = useResource<
      {
        time: string;
        remaining: number;
      }[]
    >(() => `/availability?date=${day.value}`);
    onMounted(() => {
      watch(
        () => [day.value],
        () => {
          time.value = "";
        },
        { immediate: true, flush: "post" },
      );
    });
    async function submit(e: SubmitEvent) {
      e.preventDefault();
      error.value = "";
      if (!time.value) {
        error.value = copy("请选择一个可预约时段");
        return;
      }
      const data = new FormData(e.currentTarget as HTMLFormElement);
      busy.value = true;
      try {
        await send<Booking>("/bookings", {
          serviceId: props.service.id,
          day: day.value,
          time: time.value,
          contactName: data.get("name"),
          phone: data.get("phone"),
          note: data.get("note"),
          requestKey: key.value,
        });
        props.onClose();
        navigate("/account?new=1");
      } catch (e) {
        error.value = (e as Error).message;
        slots.reload();
      } finally {
        busy.value = false;
      }
    }
    return () => (
      <Modal title={copy("预约你的专属时刻")} onClose={props.onClose}>
        <div class="booking-summary">
          <SiteImage src={props.service.image} alt="" />
          <div>
            <span class="eyebrow">{props.service.english}</span>
            <h3>{props.service.title}</h3>
            <p>
              {copy("套餐 ¥{v0} · 订金", {
                v0: money(props.service.price),
              })}
              <strong>{money(props.service.deposit)}</strong>
            </p>
          </div>
        </div>
        <form onSubmit={submit} class="form">
          <label>
            {copy("预约日期")}
            <input
              type="date"
              value={day.value}
              onInput={(e) =>
                (day.value = (e.target as HTMLInputElement).value)
              }
              min={chinaDate(site.settings?.booking.minAdvanceDays ?? 1)}
              max={chinaDate(site.settings?.booking.maxAdvanceDays ?? 90)}
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
              <div class="time-slots">
                {slots.data?.map((s) => (
                  <button
                    type="button"
                    key={s.time}
                    disabled={!s.remaining}
                    aria-pressed={time.value === s.time}
                    onClick={() => (time.value = s.time)}
                    class={time.value === s.time ? "selected" : ""}
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
          <div class="form-row">
            <label>
              {copy("怎么称呼你")}
              <input
                name="name"
                value={site.user?.name}
                maxlength={30}
                autocomplete="name"
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
                autocomplete="tel"
                required
              />
            </label>
          </div>
          <label>
            {copy("想与我们分享的期待")}
            <span class="optional">{copy("选填")}</span>
            <textarea
              name="note"
              maxlength={1000}
              placeholder={copy(
                "拍摄风格、角色主题、庆典想法，或其他特别需求…",
              )}
              rows={3}
            />
          </label>
          <label class="checkbox-label">
            <input type="checkbox" required />
            <ConsentText />
          </label>
          <ErrorNotice error={error.value} />
          <button class="button full" disabled={busy.value || slots.loading}>
            {busy.value ? copy("正在预约…") : copy("确认预约，前往订单")}
            <Arrow />
          </button>
          <p class="form-note">
            {copy("名额保留 30 分钟，请在订单页完成订金支付。")}
            <br />
            {copy("预约专属会话保留 180 天。")}
          </p>
        </form>
      </Modal>
    );
  },
  { name: "BookingModal", props: ["service", "onClose"] },
);
</script>
