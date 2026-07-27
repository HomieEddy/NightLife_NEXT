"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PulseTab } from "@/components/manager/pulse-tab";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { computeAttentionItems } from "@/lib/pulse";
import { pulseService } from "@/lib/services/pulse-service";
import { ordersService } from "@/lib/services/orders-service";
import { guestsService } from "@/lib/services/guests-service";
import { venueService } from "@/lib/services/venue-service";
import { doorService } from "@/lib/services/door-service";
import { waitlistService } from "@/lib/services/waitlist-service";
import { incidentService } from "@/lib/services/incident-service";
import { useLiveEvents } from "@/lib/use-live-events";
import type { AttentionItem } from "@/lib/types";

export default function ManagerPulsePage() {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [lastCallActive, setLastCallActive] = useState(false);
  const [managerName, setManagerName] = useState("Manager");

  const refresh = useCallback(async () => {
    const [liveOrders, helpRequests, tables, zones, venue, lastCall, sessions, adjustments, occupancy, waitlistEntries, openIncidents] = await Promise.all([
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
    setItems(
      computeAttentionItems(
        liveOrders,
        helpRequests,
        tables,
        zones,
        venue.slaThresholds,
        lastCall.active,
        venue.lastCallAutoFlagTables,
        sessions,
        adjustments,
        venue.minimumSpendWarningRatio,
        {
          occupancy: occupancy.current,
          legalCapacity: occupancy.legalCapacity,
          occupancyWarnRatio: venue.occupancyWarnRatio,
          waitlistEntries,
          openIncidents,
        },
      ),
    );
    setLastCallActive(lastCall.active);
    setManagerName("Manager");
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => { refresh(); }, [refresh]);

  useLiveEvents({
    scope: "manager",
    onEvent: () => refreshRef.current(),
    fallbackMs: 8000,
    fallbackRefresh: () => refreshRef.current(),
  });

  async function sendBroadcast(message: string) {
    await pulseService.sendBroadcast(message, managerName);
    await refresh();
  }

  async function toggleLastCall() {
    if (lastCallActive) await pulseService.endLastCall();
    else await pulseService.startLastCall(managerName);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pulse" description="Live attention feed — overdue orders, open help, capacity and incidents" />
      {items === null ? <ListSkeleton /> : (
        <PulseTab
          items={items}
          lastCallActive={lastCallActive}
          onSendBroadcast={sendBroadcast}
          onToggleLastCall={toggleLastCall}
        />
      )}
    </div>
  );
}
