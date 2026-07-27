"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { venueService } from "@/lib/services/venue-service";
import { ordersService } from "@/lib/services/orders-service";
import { guestsService } from "@/lib/services/guests-service";
import { doorService } from "@/lib/services/door-service";
import { waitlistService } from "@/lib/services/waitlist-service";
import { incidentService } from "@/lib/services/incident-service";
import { pulseService } from "@/lib/services/pulse-service";
import { computeAttentionItems } from "@/lib/pulse";
import { useLiveEvents } from "@/lib/use-live-events";
import type { AttentionItem, AttentionItemType } from "@/lib/types";

interface NavBadgeCounts {
  orders: number;
  door: number;
  chat: number;
  staff: number;
  inventory: number;
}

interface AttentionContextValue {
  items: AttentionItem[];
  count: number;
  lastCallActive: boolean;
  badgeCounts: NavBadgeCounts;
  refreshAttention: () => Promise<void>;
  sendBroadcast: (message: string, senderName: string) => Promise<void>;
  toggleLastCall: (senderName: string) => Promise<void>;
}

const AttentionContext = createContext<AttentionContextValue | null>(null);

function deriveBadgeCounts(items: AttentionItem[]): NavBadgeCounts {
  const score = (types: AttentionItemType[]) =>
    items.filter((i) => types.includes(i.type)).length;
  return {
    orders: score(["order-overdue"]),
    door: score(["capacity-warning"]),
    chat: score(["help-open"]),
    staff: score(["zone-uncovered", "clock-out-missing"]),
    inventory: score(["stock-below-par", "po-overdue"]),
  };
}

export function AttentionProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [lastCallActive, setLastCallActive] = useState(false);

  const badgeCounts = deriveBadgeCounts(items);

  const refreshAttention = useCallback(async () => {
    try {
      const [
        liveOrders, helpRequests, tables, zones, venue, lastCall,
        sessions, adjustments, occupancy, waitlistEntries, openIncidents,
      ] = await Promise.all([
        ordersService.listOrders(),
        guestsService.listHelpRequests(),
        venueService.listTables(),
        venueService.listZones(),
        venueService.getVenue(),
        pulseService.getLastCallState(),
        guestsService.listSessions("approved"),
        ordersService.listAllAdjustments(),
        doorService.getOccupancy(),
        waitlistService.listEntries("waiting"),
        incidentService.listIncidents({ status: "open" }),
      ]);
      const computed = computeAttentionItems(
        liveOrders, helpRequests, tables, zones,
        venue.slaThresholds, lastCall.active, venue.lastCallAutoFlagTables,
        sessions, adjustments, venue.minimumSpendWarningRatio,
        {
          occupancy: occupancy.current,
          legalCapacity: occupancy.legalCapacity,
          occupancyWarnRatio: venue.occupancyWarnRatio,
          waitlistEntries,
          openIncidents,
        },
      );
      setItems(computed);
      setLastCallActive(lastCall.active);
    } catch { /* ignore */ }
  }, []);

  const attentionRef = useRef(refreshAttention);
  attentionRef.current = refreshAttention;

  useEffect(() => { refreshAttention(); }, [refreshAttention]);
  useLiveEvents({
    scope: "manager",
    onEvent: () => attentionRef.current(),
    fallbackMs: 8000,
    fallbackRefresh: () => attentionRef.current(),
  });

  const toastedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const critical = items.filter((i) => i.severity === "critical" && i.type !== "clock-out-missing");
    for (const item of critical.slice(0, 3)) {
      if (toastedIds.current.has(item.id)) continue;
      toastedIds.current.add(item.id);
      toast.warning(item.message, { id: item.id, duration: 8000 });
    }
    const currentIds = new Set(items.map((i) => i.id));
    for (const id of toastedIds.current) {
      if (!currentIds.has(id)) toastedIds.current.delete(id);
    }
  }, [items]);

  const sendBroadcast = useCallback(async (message: string, senderName: string) => {
    await pulseService.sendBroadcast(message, senderName);
    await refreshAttention();
  }, [refreshAttention]);

  const toggleLastCall = useCallback(async (senderName: string) => {
    if (lastCallActive) await pulseService.endLastCall();
    else await pulseService.startLastCall(senderName);
    await refreshAttention();
  }, [lastCallActive, refreshAttention]);

  return (
    <AttentionContext.Provider
      value={{
        items,
        count: items.length,
        lastCallActive,
        badgeCounts,
        refreshAttention,
        sendBroadcast,
        toggleLastCall,
      }}
    >
      {children}
    </AttentionContext.Provider>
  );
}

export function useAttention(): AttentionContextValue {
  const ctx = useContext(AttentionContext);
  if (!ctx) throw new Error("useAttention must be used within AttentionProvider");
  return ctx;
}
