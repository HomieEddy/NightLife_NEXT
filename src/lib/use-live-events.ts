"use client";

import { useEffect, useRef } from "react";
import { assertLiveMode, isDemoMode } from "@/features/shared/app-mode";

type Scope = "manager" | "staff" | "guest";

interface LiveEventMessage {
  type: string;
  [key: string]: unknown;
}

interface UseLiveEventsOptions {
  scope: Scope;
  /** For guest scope: the session ID to pass as a query param. */
  sessionId?: string;
  /** Called on each incoming event. Typically triggers the page's refresh(). */
  onEvent: (event: LiveEventMessage) => void;
  /** Reconciliation interval in ms. SSE remains the fast path in live mode. */
  fallbackMs?: number;
  /** The refresh function to call on fallback polling. */
  fallbackRefresh?: () => void;
}

const ENDPOINT: Record<Scope, string> = {
  manager: "/api/live/manager",
  staff: "/api/live/staff",
  guest: "/api/live/guest",
};

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

/**
 * Subscribes to the venue's SSE stream. On each event whose type the server
 * already filtered to this audience, calls `onEvent`. A low-frequency refresh
 * reconciles notifications missed while the database listener is connecting.
 *
 * In demo mode, only the fallback poll runs — there's no SSE server.
 */
export function useLiveEvents({
  scope,
  sessionId,
  onEvent,
  fallbackMs = 8000,
  fallbackRefresh,
}: UseLiveEventsOptions): void {
  const onEventRef = useRef(onEvent);
  const fallbackRef = useRef(fallbackRefresh);
  useEffect(() => {
    onEventRef.current = onEvent;
    fallbackRef.current = fallbackRefresh;
  });

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let retryMs = INITIAL_RETRY_MS;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function startFallback() {
      if (fallbackInterval || !fallbackRef.current) return;
      fallbackInterval = setInterval(() => {
        if (!cancelled) fallbackRef.current?.();
      }, fallbackMs);
    }

    function stopFallback() {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    }

    function connect() {
      if (cancelled) return;
      assertLiveMode();

      let url = ENDPOINT[scope];
      if (scope === "guest" && sessionId) {
        url += `?sessionId=${encodeURIComponent(sessionId)}`;
      }

      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        retryMs = INITIAL_RETRY_MS;
        fallbackRef.current?.();
      };

      eventSource.onmessage = (e) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data) as LiveEventMessage;
          onEventRef.current(data);
        } catch {
          // malformed — skip
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        startFallback();
        if (!cancelled) {
          retryTimeout = setTimeout(() => {
            retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
            connect();
          }, retryMs);
        }
      };
    }

    startFallback();
    if (!isDemoMode()) {
      connect();
    }

    return () => {
      cancelled = true;
      eventSource?.close();
      stopFallback();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [scope, sessionId, fallbackMs]);
}
