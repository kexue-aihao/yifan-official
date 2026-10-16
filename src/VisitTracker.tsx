"use client";
import { useEffect, useRef } from "react";
import { useSite, send } from "./lib";
import { useLocation } from "./routing";
export default function VisitTracker() {
  const { loading } = useSite();
  const { pathname } = useLocation();
  const last = useRef("");
  useEffect(() => {
    if (loading || last.current === pathname) return;
    last.current = pathname;
    // Route views only. Queries, images, polling and SSE are never page views.
    void send("/visits", {
      eventId: crypto.randomUUID(),
      path: pathname.slice(0, 256),
    }).catch(() => {});
  }, [pathname, loading]);
  return null;
}
