"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Coffee, LogIn, LogOut, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { timeService } from "@/features/workforce/time-service";
import type { TimeEntry } from "@/lib/types";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function ClockCard({ staffId }: { staffId: string }) {
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const refreshEntry = useCallback(async () => {
    try {
      const e = await timeService.getCurrentEntry(staffId);
      setEntry(e);
    } catch { /* ignore */ }
  }, [staffId]);

  useEffect(() => { refreshEntry(); }, [refreshEntry]);

  // Tick the elapsed timer while clocked in
  useEffect(() => {
    if (!entry?.clockInAt || entry.clockOutAt) return;
    const update = () => setElapsed(Date.now() - new Date(entry.clockInAt!).getTime());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [entry]);

  async function handleClockIn() {
    setBusy(true);
    try {
      const e = await timeService.clockIn(staffId);
      setEntry(e);
      toast.success("Clocked in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clock in");
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    setBusy(true);
    try {
      const e = await timeService.clockOut(staffId);
      setEntry(e);
      toast.success(`Clocked out — ${e.minutesWorked} min`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clock out");
    } finally {
      setBusy(false);
    }
  }

  async function handleBreak() {
    setBusy(true);
    try {
      const lastBreak = entry?.breaks?.at(-1);
      if (!lastBreak || lastBreak.endedAt) {
        const e = await timeService.startBreak(staffId);
        setEntry(e);
        toast.success("Break started");
      } else {
        const e = await timeService.endBreak(staffId);
        setEntry(e);
        toast.success("Break ended");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not toggle break");
    } finally {
      setBusy(false);
    }
  }

  const isOnBreak = entry?.breaks && entry.breaks.length > 0 && !entry.breaks[entry.breaks.length - 1].endedAt;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            <span className="font-semibold">Time clock</span>
          </div>
          {entry && !entry.clockOutAt && (
            <span className="tabular-nums text-sm text-muted-foreground">
              <Timer className="inline size-3 mr-1" />
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          {!entry || entry.clockOutAt ? (
            <Button
              className="flex-1"
              onClick={handleClockIn}
              disabled={busy}
            >
              <LogIn className="size-4 mr-1" /> Clock in
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleBreak}
                disabled={busy}
              >
                <Coffee className="size-4 mr-1" />
                {isOnBreak ? "End break" : "Break"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleClockOut}
                disabled={busy}
              >
                <LogOut className="size-4 mr-1" /> Clock out
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
