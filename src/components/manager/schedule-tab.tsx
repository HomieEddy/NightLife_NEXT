"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, X, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { RoleBadge } from "@/components/shared/role-badge";
import { staffService } from "@/lib/services/staff-service";
import { timeService } from "@/lib/services/time-service";
import { generateWeekFromTemplates } from "@/lib/workforce";
import { cn } from "@/lib/utils";
import type { DateRangeValue } from "@/components/shared/date-range-picker";
import type { StaffMember, StaffShift, Shift, Zone } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Nightclub week: render Thursday→Sunday first, quiet days last.
const DAY_ORDER = [4, 5, 6, 0, 1, 2, 3];

interface ShiftDraft {
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  zoneId: string; // "none" = unassigned
}

function getDaysInRange(range?: DateRangeValue): Set<number> | null {
  if (!range || (!range.from && !range.to)) return null;
  const days = new Set<number>();
  const start = range.from ? new Date(range.from + "T00:00:00") : new Date(0);
  const end = range.to ? new Date(range.to + "T23:59:59") : new Date("2100-01-01");
  const cursor = new Date(start);
  // Collect unique days-of-week within range (cap at 7 iterations for safety)
  for (let i = 0; i < 7 && cursor <= end; i++) {
    days.add(cursor.getDay());
    cursor.setDate(cursor.getDate() + 1);
  }
  return days.size > 0 ? days : null;
}

/** Weekly recurring schedule: shifts grouped by night, add/remove per staff. */
export function ScheduleTab({ staff, zones, dateRange }: { staff: StaffMember[]; zones: Zone[]; dateRange?: DateRangeValue }) {
  const [shifts, setShifts] = useState<StaffShift[] | null>(null);
  const [publishedShifts, setPublishedShifts] = useState<Shift[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ShiftDraft>({
    staffId: "",
    dayOfWeek: 5,
    startTime: "22:00",
    endTime: "04:00",
    zoneId: "none",
  });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setShifts(await staffService.listShifts());
    setPublishedShifts(await timeService.listShifts());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";
  const staffRole = (id: string) => staff.find((s) => s.id === id)?.role;
  const zoneName = (id: string | null) =>
    id === null ? null : zones.find((z) => z.id === id)?.name ?? null;

  function openAdd(day?: number) {
    setDraft({
      staffId: staff[0]?.id ?? "",
      dayOfWeek: day ?? 5,
      startTime: "22:00",
      endTime: "04:00",
      zoneId: "none",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft.staffId) {
      toast.error("Pick a team member.");
      return;
    }
    setSaving(true);
    await staffService.addShift({
      staffId: draft.staffId,
      dayOfWeek: draft.dayOfWeek,
      startTime: draft.startTime,
      endTime: draft.endTime,
      zoneId: draft.zoneId === "none" ? null : draft.zoneId,
    });
    setSaving(false);
    setDialogOpen(false);
    toast.success(`${staffName(draft.staffId)} scheduled for ${DAY_LABELS[draft.dayOfWeek]}`);
    await refresh();
  }

  async function publishWeek() {
    setPublishing(true);
    try {
      const templates = await staffService.listShifts();
      const shiftTemplates = templates.map((t) => ({ ...t, venueId: "venue-1", active: true }));
      const allStaff = staff;
      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const weekStart = monday.toISOString().slice(0, 10);
      const generated = generateWeekFromTemplates(shiftTemplates, allStaff, weekStart, "venue-1");
      await timeService.publishShifts(generated);
      toast.success(`${generated.length} shifts published for the week of ${weekStart}`);
      await refresh();
    } catch { toast.error("Could not publish week"); }
    finally { setPublishing(false); }
  }

  async function remove(shift: StaffShift) {
    await staffService.removeShift(shift.id);
    toast.info(`${staffName(shift.staffId)} unscheduled from ${DAY_LABELS[shift.dayOfWeek]}`);
    await refresh();
  }

  const activeDays = getDaysInRange(dateRange);

  if (shifts === null) return <ListSkeleton rows={4} rowHeight="h-28" />;

  const filteredDays = activeDays ? DAY_ORDER.filter((d) => activeDays.has(d)) : DAY_ORDER;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <ConfirmDialog
          trigger={<Button disabled={publishing}><Send className="size-4 mr-1" /> Publish next week</Button>}
          title="Generate & publish next week?"
          description="Converts the recurring schedule below into dated shifts that staff can see and swap."
          confirmLabel="Publish"
          onConfirm={publishWeek}
        />
        <Button variant="outline" onClick={() => openAdd()}>
          <CalendarPlus className="size-4" /> Add shift
        </Button>
      </div>

      {/* Published shifts */}
      {publishedShifts.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-2 px-4 py-3">
            <p className="text-sm font-semibold text-primary">Published shifts</p>
            <div className="flex flex-wrap gap-1.5">
              {publishedShifts.slice(0, 12).map((s) => (
                <Badge key={s.id} variant="outline" className="text-xs">
                  {staffName(s.staffId)} · {new Date(s.businessDate).toLocaleDateString("en-CA", { weekday: "short" })}
                </Badge>
              ))}
              {publishedShifts.length > 12 && <Badge variant="outline" className="text-xs">+{publishedShifts.length - 12} more</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filteredDays.map((day) => {
          const dayShifts = shifts
            .filter((sh) => sh.dayOfWeek === day)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isWeekend = [4, 5, 6].includes(day);
          return (
            <Card key={day} className={cn("py-4", !isWeekend && dayShifts.length === 0 && "opacity-60")}>
              <CardContent className="space-y-2 px-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{DAY_LABELS[day]}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => openAdd(day)}
                  >
                    <CalendarPlus className="size-3.5" /> Add
                  </Button>
                </div>
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No one scheduled.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayShifts.map((shift) => {
                      const role = staffRole(shift.staffId);
                      return (
                        <li
                          key={shift.id}
                          className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {staffName(shift.staffId)}
                              </span>
                              {role && <RoleBadge role={role} className="px-1.5 py-0 text-[10px]" />}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {shift.startTime} – {shift.endTime}
                              {zoneName(shift.zoneId) && ` · ${zoneName(shift.zoneId)}`}
                            </p>
                          </div>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                                aria-label="Remove shift"
                              >
                                <X className="size-3.5" />
                              </Button>
                            }
                            title={`Unschedule ${staffName(shift.staffId)}?`}
                            description={`Removes their ${DAY_LABELS[shift.dayOfWeek]} ${shift.startTime}–${shift.endTime} shift.`}
                            confirmLabel="Remove shift"
                            destructive
                            onConfirm={() => remove(shift)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ---------- Add shift dialog ---------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Team member</Label>
              <Select
                value={draft.staffId}
                onValueChange={(staffId) => setDraft({ ...draft, staffId })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick someone" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} · {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Night</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_ORDER.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDraft({ ...draft, dayOfWeek: day })}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-colors",
                      draft.dayOfWeek === day
                        ? "border-primary bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shift-start">Start</Label>
                <Input
                  id="shift-start"
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-end">End</Label>
                <Input
                  id="shift-end"
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Zone (optional)</Label>
              <Select
                value={draft.zoneId}
                onValueChange={(zoneId) => setDraft({ ...draft, zoneId })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific zone</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : "Add shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
