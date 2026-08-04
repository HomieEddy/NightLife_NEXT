"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Loader2, X, Send } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { staffService } from "@/features/workforce/staff-service";
import { timeService } from "@/features/workforce/time-service";
import { staffKeys, timeKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import { generateWeekFromTemplates } from "@/lib/workforce";
import { zShiftInput } from "@/lib/form-schemas";
import { cn } from "@/features/shared/utils";
import type { DateRangeValue } from "@/components/shared/date-range-picker";
import type { StaffMember, StaffShift, Zone } from "@/lib/types";
import type { z } from "zod";

// Nightclub week: render Thursday→Sunday first, quiet days last.
const DAY_ORDER = [4, 5, 6, 0, 1, 2, 3];

type FormValues = z.infer<typeof zShiftInput>;
const EMPTY_VALUES: FormValues = {
  staffId: "",
  dayOfWeek: [5],
  startTime: "22:00",
  endTime: "04:00",
  zoneId: "none",
};

function getDaysInRange(range?: DateRangeValue): Set<number> | null {
  if (!range || (!range.from && !range.to)) return null;
  const days = new Set<number>();
  const start = range.from ? new Date(range.from + "T00:00:00") : new Date(0);
  const end = range.to ? new Date(range.to + "T23:59:59") : new Date("2100-01-01");
  const cursor = new Date(start);
  for (let i = 0; i < 7 && cursor <= end; i++) {
    days.add(cursor.getDay());
    cursor.setDate(cursor.getDate() + 1);
  }
  return days.size > 0 ? days : null;
}

/** Weekly recurring schedule: shifts grouped by night, add/remove per staff. */
export function ScheduleTab({ staff, zones, dateRange }: { staff: StaffMember[]; zones: Zone[]; dateRange?: DateRangeValue }) {
  const { user } = useAuth();
  const t = useTranslations("shared");
  const DAY_LABELS = [t("schedule.sun"), t("schedule.mon"), t("schedule.tue"), t("schedule.wed"), t("schedule.thu"), t("schedule.fri"), t("schedule.sat")];
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(zShiftInput),
    defaultValues: EMPTY_VALUES,
  });

  const { data: shifts } = useQuery({
    queryKey: staffKeys.shifts(venueId),
    queryFn: () => staffService.listShifts(),
    enabled: !!venueId,
  });

  const { data: publishedShifts = [] } = useQuery({
    queryKey: timeKeys.allShifts(venueId),
    queryFn: () => timeService.listShifts(),
    enabled: !!venueId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: staffKeys.shifts(venueId) });
    queryClient.invalidateQueries({ queryKey: timeKeys.allShifts(venueId) });
  };

  const addMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const day = data.dayOfWeek[0];
      return staffService.addShift({
        staffId: data.staffId,
        dayOfWeek: day,
        startTime: data.startTime,
        endTime: data.endTime,
        zoneId: data.zoneId === "none" ? null : data.zoneId,
      });
    },
    onSuccess: (_, data) => {
      const day = data.dayOfWeek[0];
      setDialogOpen(false);
      toast.success(t("schedule.scheduledToast", { name: staffName(data.staffId), day: DAY_LABELS[day] }));
      invalidate();
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const templates = await staffService.listShifts();
      const shiftTemplates = templates.map((t) => ({ ...t, venueId: venueId, active: true }));
      const allStaff = staff;
      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const weekStart = monday.toISOString().slice(0, 10);
      const generated = generateWeekFromTemplates(shiftTemplates, allStaff, weekStart, venueId);
      return timeService.publishShifts(generated);
    },
    onSuccess: () => {
      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const weekStart = monday.toISOString().slice(0, 10);
      toast.success(t("schedule.publishedToast", { weekStart }));
      invalidate();
    },
    onError: () => {
      toast.error(t("schedule.couldNotPublish"));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (shift: StaffShift) => staffService.removeShift(shift.id),
    onSuccess: (_, shift) => {
      toast.info(t("schedule.unscheduledToast", { name: staffName(shift.staffId), day: DAY_LABELS[shift.dayOfWeek] }));
      invalidate();
    },
  });

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";
  const staffRole = (id: string) => staff.find((s) => s.id === id)?.role;
  const zoneName = (id: string | null) =>
    id === null ? null : zones.find((z) => z.id === id)?.name ?? null;

  function openAdd(day?: number) {
    reset({
      staffId: staff[0]?.id ?? "",
      dayOfWeek: [day ?? 5],
      startTime: "22:00",
      endTime: "04:00",
      zoneId: "none",
    });
    setDialogOpen(true);
  }

  const onSave = handleSubmit(async (data) => {
    addMutation.mutate(data);
  });

  async function publishWeek() {
    publishMutation.mutate();
  }

  const activeDays = getDaysInRange(dateRange);

  if (shifts === undefined) return <ListSkeleton rows={4} rowHeight="h-28" />;

  const filteredDays = activeDays ? DAY_ORDER.filter((d) => activeDays.has(d)) : DAY_ORDER;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <ConfirmDialog
          trigger={<Button disabled={publishMutation.isPending}><Send className="size-4 mr-1" /> {t("schedule.publishNextWeek")}</Button>}
          title={t("schedule.publishTitle")}
          description={t("schedule.publishDescription")}
          confirmLabel={t("schedule.publishConfirm")}
          onConfirm={publishWeek}
        />
        <Button variant="outline" onClick={() => openAdd()}>
          <CalendarPlus className="size-4" /> {t("schedule.addShift")}
        </Button>
      </div>

      {/* Published shifts */}
      {publishedShifts.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-2 px-4 py-3">
            <p className="text-sm font-semibold text-primary">{t("schedule.publishedShifts")}</p>
            <div className="flex flex-wrap gap-1.5">
              {publishedShifts.slice(0, 12).map((s) => (
                <Badge key={s.id} variant="outline" className="text-xs">
                  {staffName(s.staffId)} · {new Date(s.businessDate).toLocaleDateString("en-CA", { weekday: "short" })}
                </Badge>
              ))}
              {publishedShifts.length > 12 && <Badge variant="outline" className="text-xs">{t("schedule.moreCount", { count: publishedShifts.length - 12 })}</Badge>}
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
                    <CalendarPlus className="size-3.5" /> {t("schedule.add")}
                  </Button>
                </div>
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("schedule.noOneScheduled")}</p>
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
                                aria-label={t("schedule.removeShiftAria")}
                              >
                                <X className="size-3.5" />
                              </Button>
                            }
                            title={t("schedule.unscheduleTitle", { name: staffName(shift.staffId) })}
                            description={t("schedule.unscheduleDescription", { day: DAY_LABELS[shift.dayOfWeek], start: shift.startTime, end: shift.endTime })}
                            confirmLabel={t("schedule.unscheduleConfirm")}
                            destructive
                            onConfirm={() => removeMutation.mutate(shift)}
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
            <DialogTitle>{t("schedule.addAShift")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("schedule.teamMember")}</Label>
              <Select
                value={watch("staffId")}
                onValueChange={(staffId) => setValue("staffId", staffId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("schedule.pickSomeone")} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} · {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.staffId && <p className="text-xs text-red-600">{errors.staffId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("schedule.night")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_ORDER.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setValue("dayOfWeek", [day])}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-colors",
                      watch("dayOfWeek")[0] === day
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
                <Label htmlFor="shift-start">{t("schedule.start")}</Label>
                <Input id="shift-start" type="time" {...register("startTime")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-end">{t("schedule.end")}</Label>
                <Input id="shift-end" type="time" {...register("endTime")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("schedule.zoneOptional")}</Label>
              <Select
                value={watch("zoneId")}
                onValueChange={(zoneId) => setValue("zoneId", zoneId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("schedule.noSpecificZone")}</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>
              {t("schedule.cancel")}
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {addMutation.isPending ? t("schedule.saving") : t("schedule.addShift")}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
