"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Minus, Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { waitlistService } from "@/lib/services/waitlist-service";
import type { WaitlistEntryWithPosition } from "@/lib/mock-services/waitlist-service";
import { cn } from "@/lib/utils";

const QUOTE_PRESETS = [15, 30, 45];

const STATUS_LABEL: Record<WaitlistEntryWithPosition["status"], string> = {
  waiting: "Waiting",
  notified: "Notified",
  seated: "Seated",
  left: "Left",
  expired: "Expired",
};

/** Shares the same waitlist state as /staff/door — a table on reservations page for manager visibility. */
export function WaitlistPanel() {
  const [entries, setEntries] = useState<WaitlistEntryWithPosition[] | null>(null);
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [quotedMinutes, setQuotedMinutes] = useState(15);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEntries(await waitlistService.listEntries());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const active = (entries ?? []).filter((e) => e.status === "waiting" || e.status === "notified");
  const history = (entries ?? []).filter((e) => e.status !== "waiting" && e.status !== "notified");

  async function join() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await waitlistService.join({ name: name.trim(), partySize, quotedMinutes });
      setName("");
      setPartySize(2);
      setQuotedMinutes(15);
      toast.success(`${name.trim()} added to the waitlist`);
      await refresh();
    } catch {
      toast.error("Could not add to the waitlist");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "notified" | "left" | "seated") {
    await waitlistService.setStatus(id, status);
    await refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {entries === null ? (
          <ListSkeleton rows={3} rowHeight="h-16" />
        ) : active.length === 0 ? (
          <EmptyState icon={Users} title="No one waiting" description="Walk-ins added at the door show up here." />
        ) : (
          <div className="space-y-2">
            {active.map((entry) => {
              const elapsed = Math.round((Date.now() - new Date(entry.joinedAt).getTime()) / 60_000);
              const over = elapsed > entry.quotedMinutes;
              return (
                <Card key={entry.id} className={cn(over && "border-amber-500/40")}>
                  <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        #{entry.position ?? "—"} {entry.name} <span className="font-normal text-muted-foreground">— party of {entry.partySize}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {elapsed}m elapsed, quoted {entry.quotedMinutes}m · {STATUS_LABEL[entry.status]}
                        {entry.phone && ` · ${entry.phone}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {entry.status === "waiting" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(entry.id, "notified")}>Notify</Button>
                      )}
                      <Button size="sm" onClick={() => setStatus(entry.id, "seated")}>Seat</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(entry.id, "left")}>Leave</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Earlier tonight</p>
            {history.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>{entry.name} · party of {entry.partySize}</span>
                <span className="text-xs text-muted-foreground">{STATUS_LABEL[entry.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm font-medium">Add a walk-in</p>
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs">Party</Label>
            <Button variant="outline" size="icon" className="size-9" onClick={() => setPartySize((p) => Math.max(1, p - 1))}>
              <Minus className="size-4" />
            </Button>
            <span className="w-6 text-center tabular-nums">{partySize}</span>
            <Button variant="outline" size="icon" className="size-9" onClick={() => setPartySize((p) => p + 1)}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs">Quote</Label>
            <div className="flex gap-1.5">
              {QUOTE_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={quotedMinutes === m ? "default" : "outline"}
                  onClick={() => setQuotedMinutes(m)}
                >
                  <Clock className="size-3.5" /> {m}m
                </Button>
              ))}
            </div>
          </div>
          <Button className="w-full" disabled={!name.trim() || busy} onClick={join}>
            <UserPlus className="size-4" /> Add to waitlist
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
