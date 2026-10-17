import { LayoutGroup, motion } from "motion-v";
import { computed, defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useCopy } from "./i18n";
export const flowEase = [0.16, 1, 0.3, 1] as [number, number, number, number];
export const layoutFlow = {
  type: "spring",
  stiffness: 340,
  damping: 34,
} as const;
export function useMotionPreference() {
  const reduced = ref(false);
  let media: MediaQueryList | undefined;
  const update = () => {
    reduced.value = !!media?.matches;
  };
  onMounted(() => {
    media = matchMedia("(prefers-reduced-motion: reduce)");
    update();
    media.addEventListener("change", update);
  });
  onUnmounted(() => media?.removeEventListener("change", update));
  return reduced;
}
export function useReveal(delay = 0) {
  const reduced = useMotionPreference();
  return computed(() => ({
    "data-flow": "reveal",
    initial: reduced.value ? (false as const) : { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: {
      duration: reduced.value ? 0 : 0.54,
      delay: reduced.value ? 0 : delay,
      ease: flowEase,
    },
  }));
}
export function useImageReveal() {
  const reduced = useMotionPreference();
  return computed(() => ({
    "data-flow": "image",
    initial: reduced.value
      ? (false as const)
      : { clipPath: "inset(5% 0% 5% 0%)", opacity: 0.7 },
    whileInView: { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: reduced.value ? 0 : 0.68, ease: flowEase },
  }));
}
export const FilterTabs = defineComponent(
  (props: {
    items: string[];
    value: string;
    onChange: (value: string) => void;
    label: string;
  }) => {
    const reduced = useMotionPreference(),
      copy = useCopy();
    return () => (
      <LayoutGroup>
        <div
          class="filter-tabs motion-tabs"
          role="group"
          aria-label={props.label}
        >
          {props.items.map((item) => (
            <button
              key={item}
              class={item === props.value ? "active" : ""}
              aria-pressed={item === props.value}
              onClick={() => props.onChange(item)}
            >
              {item === props.value && (
                <motion.span
                  class="filter-highlight"
                  layoutId="filter-highlight"
                  transition={reduced.value ? { duration: 0 } : layoutFlow}
                />
              )}
              <span class="filter-label">{copy(item)}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
    );
  },
  { name: "FilterTabs", props: ["items", "value", "onChange", "label"] },
);
