import { nextTick, onMounted, onUnmounted } from "vue";
import type { Router } from "vue-router";
import { stripLocale } from "./routing";

// Client routing should give keyboard and screen-reader users a page arrival.
// Query/filter changes, anchors and language changes retain their own focus.
export function useRouteFocus(router: Router) {
  let stop: (() => void) | undefined;
  onMounted(() => {
    stop = router.afterEach(async (to, from, failure) => {
      if (failure || to.hash || stripLocale(to.path) === stripLocale(from.path))
        return;
      await nextTick();
      if (
        router.currentRoute.value !== to ||
        document.querySelector("dialog[open]")
      )
        return;
      const heading = document.querySelector<HTMLElement>("#main h1");
      if (heading) heading.tabIndex = -1;
      (heading || document.querySelector<HTMLElement>("#main"))?.focus({
        preventScroll: true,
      });
    });
  });
  onUnmounted(() => stop?.());
}

// Safari touch clicks do not focus buttons. Remember the actual opener so
// closing a dialog restores a useful focus target on touch and keyboard alike.
let trigger: WeakRef<HTMLElement> | undefined;
export function useDialogFocusTracking() {
  const clicked = (event: MouseEvent) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            "button, a[href], input, select, textarea, [tabindex]",
          )
        : null;
    trigger = target ? new WeakRef(target) : undefined;
  };
  const keyed = () => {
    trigger = undefined;
  };
  onMounted(() => {
    document.addEventListener("click", clicked, true);
    document.addEventListener("keydown", keyed, true);
  });
  onUnmounted(() => {
    document.removeEventListener("click", clicked, true);
    document.removeEventListener("keydown", keyed, true);
    trigger = undefined;
  });
}
export function dialogOpener() {
  const clicked = trigger?.deref();
  return clicked?.isConnected
    ? clicked
    : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
}
