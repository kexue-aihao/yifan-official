"use client";
import { useCopy } from "./i18n";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, LoaderCircle, X } from "lucide-react";

export const Arrow = () => (
  <ArrowUpRight size={17} strokeWidth={1.5} aria-hidden="true" />
);
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function ErrorNotice({ error }: { error?: string }) {
  const copy = useCopy();
  return error ? (
    <p className="error-notice" role="alert">
      {copy(error)}
    </p>
  ) : null;
}
export function Loading() {
  const copy = useCopy();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} />
      {copy("正在加载…")}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-flower">✳</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const copy = useCopy();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={copy("关闭弹窗")}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
