"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { pulseService } from "@/features/realtime/pulse-service";
import { useLiveEvents } from "@/lib/use-live-events";
import type { Broadcast } from "@/lib/types";

const BROADCAST_TTL_MS = 3 * 60_000;

/**
 * Full-screen-width alert strip for the manager's emergency broadcast and
 * last-call state — impossible to miss even if a runner isn't in chat.
 * Mounted once in staff/layout.tsx, above the header.
 */
export function BroadcastBanner() {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [lastCallActive, setLastCallActive] = useState(false);

  const refresh = useCallback(async () => {
    const [broadcasts, lastCall] = await Promise.all([
      pulseService.listBroadcasts(),
      pulseService.getLastCallState(),
    ]);
    const latest = broadcasts[0] ?? null;
    const fresh = latest !== null && Date.now() - new Date(latest.sentAt).getTime() < BROADCAST_TTL_MS;
    setBroadcast(fresh ? latest : null);
    setLastCallActive(lastCall.active);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useLiveEvents({
    scope: "staff",
    onEvent: (e) => {
      if (e.type === "BroadcastSent" || e.type === "LastCallStarted" || e.type === "LastCallEnded") {
        refreshRef.current();
      }
    },
    fallbackMs: 8000,
    fallbackRefresh: () => refreshRef.current(),
  });

  const showBroadcast = broadcast !== null && broadcast.id !== dismissedId;
  if (!showBroadcast && !lastCallActive) return null;

  return (
    <div>
      {showBroadcast && broadcast && (
        <div className="flex items-center justify-between gap-3 bg-red-600 px-4 py-3 text-sm font-medium text-white">
          <span className="flex min-w-0 items-center gap-2">
            <Megaphone className="size-4 shrink-0" />
            <span className="truncate">{broadcast.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setDismissedId(broadcast.id)}
            className="shrink-0 rounded-md p-1 hover:bg-white/20"
            aria-label="Dismiss broadcast"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {lastCallActive && (
        <div className="foil px-4 py-2 text-center text-sm font-semibold">
          Last call — no new orders are being accepted
        </div>
      )}
    </div>
  );
}
