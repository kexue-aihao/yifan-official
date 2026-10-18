<script lang="tsx">
import {
  defineComponent,
  inject,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  shallowRef,
  type InjectionKey,
} from "vue";
import type { NavigationFailure, Router } from "vue-router";
import { locales } from "../i18n/locales.mjs";

type Commit = () => Promise<void | NavigationFailure | undefined>;
type Flow = ReturnType<typeof provideRouteTransitions>;
const key: InjectionKey<Flow> = Symbol("route-flow");
function pagePath(path: string) {
  const parts = path.split("/");
  if (locales.includes(parts[1])) parts.splice(1, 1);
  return parts.join("/") || "/";
}
export function useRouteTransition() {
  return inject(key)!;
}

// The router owns the sequence, so links, redirects and browser history all
// use the same transition. Lazy modules load while the current page stays live.
export function provideRouteTransitions(router: Router) {
  const phase = ref("idle");
  const snapshot = shallowRef<HTMLElement | null>(null);
  const animations = new Set<Animation>();
  let generation = 0;
  let destination = "";
  let previousPosition = Number(router.options.history.state.position || 0);
  let direction = 1;
  let media: MediaQueryList | undefined;

  function clear() {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    snapshot.value?.replaceChildren();
    if (typeof document !== "undefined")
      delete document.documentElement.dataset.routeMoving;
  }
  function cancel() {
    generation++;
    clear();
    phase.value = "idle";
  }
  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function animate(element: HTMLElement, frames: Keyframe[], duration: number) {
    const animation = element.animate(frames, {
      duration,
      easing: "cubic-bezier(.16,1,.3,1)",
      fill: "both",
    });
    animations.add(animation);
    return animation.finished.catch(() => {});
  }
  const offStart = router.beforeEach((to, from) => {
    generation++;
    destination = to.fullPath;
    if (
      !from.matched.length ||
      pagePath(to.path) === pagePath(from.path) ||
      reduced()
    ) {
      clear();
      phase.value = "idle";
      return;
    }
    phase.value = "waiting";
  });
  const offPrepare = router.beforeResolve((to, from) => {
    if (to.fullPath !== destination || phase.value === "idle") return;
    const stage = document.querySelector<HTMLElement>("#main > .route-stage");
    if (!stage || !snapshot.value || !stage.animate || reduced()) {
      cancel();
      return;
    }
    // Clone only at commit time. This inert, viewport-clipped copy preserves
    // the outgoing composition and scroll position without retaining a view.
    const bounds = stage.getBoundingClientRect();
    const clone = stage.cloneNode(true) as HTMLElement;
    // DOM cloning does not copy a running WAAPI effect. Freeze its visible
    // properties too, including a hero reveal or a filter still in progress.
    const frozen = new Set<Element>();
    for (const animation of stage.getAnimations({ subtree: true })) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (
        !(target instanceof Element) ||
        target === stage ||
        frozen.has(target)
      )
        continue;
      frozen.add(target);
      const path: number[] = [];
      let node: Element | null = target;
      while (node && node !== stage) {
        const parent: Element | null = node.parentElement;
        if (!parent) break;
        path.unshift(Array.prototype.indexOf.call(parent.children, node));
        node = parent;
      }
      let copy: Element = clone;
      for (const index of path) copy = copy.children[index];
      if (copy instanceof HTMLElement || copy instanceof SVGElement) {
        const style = getComputedStyle(target);
        copy.style.opacity = style.opacity;
        copy.style.transform = style.transform;
        copy.style.clipPath = style.clipPath;
      }
    }
    clone.inert = true;
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("id");
    clone.querySelectorAll("[id], [autofocus]").forEach((element) => {
      element.removeAttribute("id");
      element.removeAttribute("autofocus");
    });
    // Visual copies must not register duplicate form fields with autofill or
    // tools addressing the live page's controls during the overlap.
    clone
      .querySelectorAll("[name]")
      .forEach((element) => element.removeAttribute("name"));
    clone
      .querySelectorAll("script, iframe, video, audio, dialog, [popover]")
      .forEach((el) => el.remove());
    Object.assign(clone.style, {
      position: "absolute",
      top: `${bounds.top}px`,
      left: `${bounds.left}px`,
      width: `${bounds.width}px`,
      margin: "0",
      opacity: getComputedStyle(stage).opacity,
      transform: "none",
    });
    clear();
    snapshot.value.replaceChildren(clone);
    const position = Number(router.options.history.state.position || 0);
    direction =
      position !== previousPosition
        ? Math.sign(position - previousPosition)
        : from.path.startsWith(to.path.replace(/\/$/, "") + "/")
          ? -1
          : 1;
    document.documentElement.dataset.routeMoving = "true";
    phase.value = "switching";
  });
  const offFinish = router.afterEach(async (to, _from, failure) => {
    if (to.fullPath !== destination) return;
    previousPosition = Number(router.options.history.state.position || 0);
    if (failure) {
      cancel();
      return;
    }
    if (phase.value !== "switching") return;
    const current = generation;
    await nextTick();
    if (current !== generation) return;
    const stage = document.querySelector<HTMLElement>("#main > .route-stage");
    const outgoing = snapshot.value?.firstElementChild as HTMLElement | null;
    if (!stage || !outgoing || reduced()) {
      cancel();
      return;
    }
    phase.value = "entering";
    // Arrivals overlap the shorter exit; no empty frame or blocking curtain.
    const incoming = animate(
      stage,
      [
        { opacity: 0, transform: `translateY(${direction * 20}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      420,
    );
    const leaving = animate(
      outgoing,
      [
        {
          opacity: getComputedStyle(outgoing).opacity,
          transform: "translateY(0)",
        },
        { opacity: 0, transform: `translateY(${direction * -12}px)` },
      ],
      180,
    );
    delete document.documentElement.dataset.routeMoving;
    await Promise.all([incoming, leaving]);
    if (current === generation) {
      clear();
      phase.value = "idle";
    }
  });
  const offError = router.onError(cancel);
  if (typeof window !== "undefined") {
    media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", cancel);
    window.addEventListener("resize", cancel);
  }
  onBeforeUnmount(() => {
    cancel();
    offStart();
    offPrepare();
    offFinish();
    offError();
    media?.removeEventListener("change", cancel);
    if (typeof window !== "undefined")
      window.removeEventListener("resize", cancel);
  });
  const flow = {
    phase,
    snapshot,
    navigate: (commit: Commit) => commit(),
    cancel,
  };
  provide(key, flow);
  return flow;
}

export const RouteTransitions = defineComponent(
  (_props, { slots }) => {
    const flow = useRouteTransition();
    return () => (
      <>
        {slots.default?.()}
        <div
          class="route-transition"
          data-phase={flow.phase.value}
          aria-hidden="true"
          inert
        >
          <div class="route-snapshot" ref={flow.snapshot} />
        </div>
        <div
          class="navigation-progress"
          data-phase={flow.phase.value}
          aria-hidden="true"
        />
      </>
    );
  },
  { name: "RouteTransitions" },
);

export default {};
</script>
