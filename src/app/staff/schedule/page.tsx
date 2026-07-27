"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { staffService } from "@/lib/services/staff-service";
import { venueService } from "@/lib/services/venue-service";
import type { StaffMember, StaffShift, Zone } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Nightclub week: Thu→Sun first, quiet days last.
const DAY_ORDER = [4, 5, 6, 0, 1, 2, 3];

export default function StaffSchedulePage() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [shifts, setShifts] = useState<StaffShift[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    Promise.all([
      staffService.getCurrentStaff(),
      staffService.listShifts(),
      venueService.listZones(),
    ]).then(([currentStaff, allShifts, zoneList]) => {
      setMe(currentStaff);
      setShifts(allShifts.filter((s) => s.staffId === currentStaff.id));
      setZones(zoneList);
    });
  }, []);

  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));

  const byDay = DAY_ORDER.map((day) => ({
    day,
    label: DAY_LABELS[day],
    shifts: (shifts ?? []).filter((s) => s.dayOfWeek === day),
  })).filter((d) => d.shifts.length > 0);

  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          <CalendarDays className="size-5 text-primary" /> My schedule
        </h1>
        {me && (
          <p className="mt-0.5 text-sm text-muted-foreground capitalize">{me.role} · weekly recurring shifts</p>
        )}
      </div>

      {shifts === null ? (
        <ListSkeleton rows={3} rowHeight="h-20" />
      ) : byDay.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No shifts scheduled"
          description="Your manager will add your shifts here when they're set."
        />
      ) : (
        <div className="space-y-3">
          {byDay.map(({ day, label, shifts: dayShifts }) => (
            <Card key={day} className="py-4">
              <CardContent className="space-y-2 px-4">
                <p className="text-sm font-semibold text-primary">{label}</p>
                {dayShifts.map((shift) => (
                  <div key={shift.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="size-3.5" />
                      {shift.startTime} – {shift.endTime}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {shift.zoneId ? zoneMap.get(shift.zoneId) ?? shift.zoneId : "All areas"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
