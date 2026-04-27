"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ErrPayload = {
  level: "error" | "warn";
  message: string;
  path: string;
  details?: Record<string, unknown>;
};

async function sendError(payload: ErrPayload) {
  if (!isSupabaseConfigured()) {
    return;
  }
  const supabase = getSupabaseBrowserClient();
  await supabase.from("client_errors").insert({
    level: payload.level,
    message: payload.message.slice(0, 2000),
    path: payload.path.slice(0, 512),
    user_agent: navigator.userAgent.slice(0, 512),
    details: payload.details ?? null,
  });
}

export function ErrorTelemetryBootstrap() {
  useEffect(() => {
    let lastSentAt = 0;
    const minIntervalMs = 1500;
    const maybeSend = (payload: ErrPayload) => {
      const now = Date.now();
      if (now - lastSentAt < minIntervalMs) {
        return;
      }
      lastSentAt = now;
      void sendError(payload);
    };

    const onError = (event: ErrorEvent) => {
      maybeSend({
        level: "error",
        message: event.message || "Unhandled browser error",
        path: window.location.pathname,
        details: {
          source: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "Unhandled promise rejection";
      maybeSend({
        level: "error",
        message: reason,
        path: window.location.pathname,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
