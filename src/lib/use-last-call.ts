"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pulseService } from "@/features/realtime/pulse-service";
import { useLiveEvents } from "@/lib/use-live-events";

/** Watches whether the manager has started last call — blocks new guest orders while true. */
export function useLastCall(): boolean {
  const [active, setActive] = useState(false);

  const refresh = useCallback(async () => {
    const state = await pulseService.getLastCallState();
    setActive(state.active);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useLiveEvents({
    scope: "staff",
    onEvent: (e) => {
      if (e.type === "LastCallStarted") setActive(true);
      else if (e.type === "LastCallEnded") setActive(false);
    },
    fallbackMs: 8000,
    fallbackRefresh: () => refreshRef.current(),
  });

  return active;
}
