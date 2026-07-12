"use client";

import { useEffect, useState } from "react";
import { pulseService } from "@/lib/services/pulse-service";

const POLL_MS = 8000;

/** Polls whether the manager has started last call — blocks new guest orders while true. */
export function useLastCall(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const state = await pulseService.getLastCallState();
      if (!cancelled) setActive(state.active);
    }
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return active;
}
