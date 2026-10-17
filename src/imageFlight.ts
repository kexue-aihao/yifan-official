// One fixed image changes its crop between the thumbnail and the lightbox.
// Bounding this work to a single image avoids stretching the photograph or
// asking the rest of the document to relayout during a shared-element flight.
function contentRect(image: HTMLImageElement, fallback: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  if (getComputedStyle(image).objectFit !== "contain")
    return image.closest(".image-wrap")?.getBoundingClientRect() || rect;
  const width = image.naturalWidth || fallback.naturalWidth;
  const height = image.naturalHeight || fallback.naturalHeight;
  if (!width || !height) return rect;
  const scale = Math.min(rect.width / width, rect.height / height);
  const w = width * scale,
    h = height * scale;
  return new DOMRect(
    rect.x + (rect.width - w) / 2,
    rect.y + (rect.height - h) / 2,
    w,
    h,
  );
}

export function imageFlight(
  dialog: HTMLDialogElement,
  origin: HTMLImageElement,
  target: HTMLImageElement,
  closing = false,
  start?: DOMRect,
) {
  const from = start || contentRect(closing ? target : origin, origin);
  const to = contentRect(closing ? origin : target, origin);
  if (!from.width || !to.width || !origin.naturalWidth) return;
  const image = document.createElement("img");
  image.className = "image-flight";
  image.src = origin.currentSrc || origin.src;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.referrerPolicy = origin.referrerPolicy;
  const frame = (rect: DOMRect) => ({
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  Object.assign(image.style, frame(to));
  dialog.append(image);
  const originVisibility = origin.style.visibility;
  const targetVisibility = target.style.visibility;
  origin.style.visibility = target.style.visibility = "hidden";
  const animation = image.animate([frame(from), frame(to)], {
    duration: closing ? 300 : 460,
    easing: "cubic-bezier(.16,1,.3,1)",
    fill: "both",
  });
  let disposed = false;
  const cancel = () => {
    if (disposed) return;
    disposed = true;
    origin.style.visibility = originVisibility;
    target.style.visibility = targetVisibility;
    animation.cancel();
    image.remove();
    window.removeEventListener("resize", cancel);
  };
  window.addEventListener("resize", cancel, { once: true });
  return {
    bounds: () =>
      image.isConnected ? image.getBoundingClientRect() : undefined,
    finished: animation.finished.catch(() => {}).then(cancel),
    cancel,
  };
}
