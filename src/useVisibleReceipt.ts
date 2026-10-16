"use client";
import {useEffect, type RefObject} from "react";

// Only acknowledge content that is rendered in the active, visible document.
// List previews and messages outside the scroll viewport never count as read.
export function useVisibleReceipt(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onVisible: (elements: HTMLElement[]) => void,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const visible = new Set<HTMLElement>();
    let timer: ReturnType<typeof setTimeout>;
    const canRead = () => {
      const dialog = document.querySelector("dialog[open]");
      return document.visibilityState === "visible" && document.hasFocus()
        && (!dialog || dialog.contains(root));
    };
    const flush = () => {
      clearTimeout(timer);
      if (!canRead()) return;
      timer = setTimeout(() => {
        if (canRead() && visible.size)
          onVisible([...visible]);
      }, 200);
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRect.height > 0 && entry.intersectionRect.width > 0)
          visible.add(entry.target as HTMLElement);
        else visible.delete(entry.target as HTMLElement);
      }
      flush();
    }, {threshold: 0});
    const observed = new Set<HTMLElement>();
    const observeContent = () => {
      const elements = new Set(root.querySelectorAll<HTMLElement>("[data-receipt-id]"));
      for (const element of observed) {
        if (!elements.has(element)) {
          observer.unobserve(element);
          observed.delete(element);
          visible.delete(element);
        }
      }
      for (const element of elements) {
        if (!observed.has(element)) {
          observed.add(element);
          observer.observe(element);
        }
      }
      flush();
    };
    observeContent();
    // History pagination can add elements without a network resource reload.
    const mutations = new MutationObserver(observeContent);
    mutations.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ["data-receipt-id"]});
    document.addEventListener("visibilitychange", flush);
    document.addEventListener("yifan-modal-change", flush);
    window.addEventListener("focus", flush);
    window.addEventListener("blur", flush);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener("visibilitychange", flush);
      document.removeEventListener("yifan-modal-change", flush);
      window.removeEventListener("focus", flush);
      window.removeEventListener("blur", flush);
    };
  }, [ref, enabled, onVisible]);
}
