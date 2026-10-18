<script lang="tsx">
import { ArrowUpRight, LoaderCircle, X } from "lucide-vue-next";
import {
  defineComponent,
  onMounted,
  shallowRef,
  watch,
  type VNodeChild,
} from "vue";
import { useCopy } from "./i18n.vue";
import { dialogOpener } from "./focus";
import { imageFlight } from "./imageFlight";
import { useMotionPreference } from "./motion.vue";
export const Arrow = () => (
  <ArrowUpRight size={17} strokeWidth={1.5} aria-hidden="true" />
);
export const SectionTitle = defineComponent(
  (
    props: {
      eyebrow: string;
      title: string;
      children?: VNodeChild;
    },
    { slots: componentSlots },
  ) =>
    () => (
      <div class="section-heading">
        <div>
          <span class="eyebrow">{props.eyebrow}</span>
          <h2>{props.title}</h2>
        </div>
        {componentSlots.default?.()}
      </div>
    ),
  { name: "SectionTitle", props: ["eyebrow", "title"] },
);
export const ErrorNotice = defineComponent(
  (props: { error?: string }) => {
    const copy = useCopy();
    return () =>
      props.error ? (
        <p class="error-notice" role="alert">
          {copy(props.error)}
        </p>
      ) : null;
  },
  { name: "ErrorNotice", props: ["error"] },
);
export const Loading = defineComponent(
  () => {
    const copy = useCopy();
    return () => (
      <div class="loading" role="status">
        <LoaderCircle class="spin" size={20} />
        {copy("正在加载…")}
      </div>
    );
  },
  { name: "Loading", props: [] },
);
export const Empty = defineComponent(
  (
    props: {
      title: string;
      children?: VNodeChild;
    },
    { slots: componentSlots },
  ) =>
    () => (
      <div class="empty">
        <span class="empty-flower">✳</span>
        <h3>{props.title}</h3>
        {componentSlots.default?.()}
      </div>
    ),
  { name: "Empty", props: ["title"] },
);
export const Modal = defineComponent(
  (
    props: {
      title: string;
      children?: VNodeChild;
      onClose: () => void;
      wide?: boolean;
      origin?: HTMLImageElement | null;
    },
    { slots: componentSlots },
  ) => {
    const copy = useCopy();
    const ref = shallowRef<HTMLDialogElement | null>(null);
    const reduced = useMotionPreference();
    const closing = shallowRef(false);
    const closeAnimation = shallowRef<Animation | null>(null);
    let flight: ReturnType<typeof imageFlight>;
    let entrance: Animation | undefined;
    watch(reduced, (value) => {
      if (!value) return;
      flight?.cancel();
      entrance?.cancel();
      if (closing.value) props.onClose();
    });
    function requestClose() {
      const dialog = ref.value;
      if (!dialog || closing.value) return;
      if (reduced.value) {
        props.onClose();
        return;
      }
      closing.value = true;
      dialog.dataset.closing = "true";
      const target = dialog.querySelector<HTMLImageElement>(".lightbox-image");
      if (
        props.origin?.isConnected &&
        target &&
        props.origin.getBoundingClientRect().bottom > 0 &&
        props.origin.getBoundingClientRect().top < innerHeight
      ) {
        const start = flight?.bounds();
        flight?.cancel();
        flight = imageFlight(dialog, props.origin, target, true, start);
        const inner = dialog.querySelector<HTMLElement>(".modal-inner")!;
        const opacity = getComputedStyle(inner).opacity;
        entrance?.cancel();
        closeAnimation.value = inner.animate([{ opacity }, { opacity: 0 }], {
          duration: 180,
          fill: "both",
          easing: "ease-out",
        });
        void (
          flight?.finished || closeAnimation.value.finished.catch(() => {})
        ).then(() => {
          if (dialog.isConnected) props.onClose();
        });
        return;
      }
      flight?.cancel();
      const current = getComputedStyle(dialog);
      const animation = dialog.animate(
        [
          { opacity: current.opacity, transform: current.transform },
          { opacity: 0, transform: "translateY(12px) scale(0.985)" },
        ],
        {
          duration: 180,
          easing: "cubic-bezier(0.4, 0, 1, 1)",
          fill: "forwards",
        },
      );
      closeAnimation.value = animation;
      void animation.finished.then(
        () => {
          if (dialog.isConnected) props.onClose();
        },
        () => {},
      );
    }
    onMounted(() => {
      watch(
        () => [],
        (_next, _previous, onCleanup) => {
          const d = ref.value!;
          const opener = dialogOpener();
          const originBounds =
            props.origin?.closest(".image-wrap")?.getBoundingClientRect() ||
            props.origin?.getBoundingClientRect();
          d.showModal();
          document.dispatchEvent(new Event("yifan-modal-change"));
          const previous = document.body.style.overflow;
          document.body.style.overflow = "hidden";
          const target = d.querySelector<HTMLImageElement>(".lightbox-image");
          if (props.origin && target && !reduced.value) {
            if (!target.complete && props.origin.naturalWidth)
              target.style.aspectRatio = `${props.origin.naturalWidth} / ${props.origin.naturalHeight}`;
            flight = imageFlight(d, props.origin, target, false, originBounds);
            entrance = d
              .querySelector<HTMLElement>(".modal-inner")!
              .animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 280,
                easing: "ease-out",
              });
          }
          onCleanup(() => {
            flight?.cancel();
            entrance?.cancel();
            closeAnimation.value?.cancel();
            d.close();
            document.body.style.overflow = previous;
            document.dispatchEvent(new Event("yifan-modal-change"));
            if (
              opener?.isConnected &&
              !document.querySelector("dialog[open]")
            ) {
              opener.focus({ preventScroll: true });
            }
          });
        },
        { immediate: true, flush: "post" },
      );
    });
    return () => (
      <dialog
        ref={ref}
        class={`modal ${(props.wide ?? false) ? "wide" : ""}`}
        data-shared-image={props.origin ? "true" : undefined}
        onCancel={(e) => {
          e.preventDefault();
          requestClose();
        }}
        onClick={(e) => {
          if (e.target === ref.value) requestClose();
        }}
        aria-label={props.title}
      >
        <div class="modal-inner">
          <div class="modal-heading">
            <h2>{props.title}</h2>
            <button
              class="icon-button"
              onClick={requestClose}
              aria-label={copy("关闭弹窗")}
            >
              <X size={22} />
            </button>
          </div>
          {componentSlots.default?.()}
        </div>
      </dialog>
    );
  },
  { name: "Modal", props: ["title", "onClose", "wide", "origin"] },
);

export default {};
</script>
