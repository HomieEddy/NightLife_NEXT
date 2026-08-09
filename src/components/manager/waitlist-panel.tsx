"use client";

import { useEffect, useState } from "react";
import { Clock, Minus, Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { waitlistService } from "@/features/door/waitlist-service";
import { waitlistKeys } from "@/features/door/query-keys";
import { useAuth } from "@/context/auth-context";
import { zWaitlistEntryInput } from "@/lib/form-schemas";
import type { WaitlistEntryWithPosition } from "@/features/door/waitlist-service";
import { cn } from "@/features/shared/utils";
import type { z } from "zod";

const QUOTE_PRESETS = [15, 30, 45];

/** Shares the same waitlist state as /staff/door — a table on reservations page for manager visibility. */
export function WaitlistPanel() {
  const t = useTranslations("shared");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const STATUS_LABEL: Record<WaitlistEntryWithPosition["status"], string> = {
    waiting: t("waitlist.waiting"),
    notified: t("waitlist.notified"),
    seated: t("waitlist.seated"),
    left: t("waitlist.left"),
    expired: t("waitlist.expired"),
  };

  type FormValues = z.infer<typeof zWaitlistEntryInput>;
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(zWaitlistEntryInput),
    defaultValues: { name: "", partySize: 2, quotedMinutes: 15 },
  });
  const quotedMinutes = watch("quotedMinutes");
  const partySize = watch("partySize");

  const { data: entries } = useQuery({
    queryKey: waitlistKeys.all(venueId),
    queryFn: () => waitlistService.listEntries(),
    enabled: !!venueId,
  });

  // Tick every 30s for elapsed-time display
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: waitlistKeys.all(venueId) });
  };

  const joinMutation = useMutation({
    mutationFn: (data: FormValues) =>
      waitlistService.join({ name: data.name.trim(), partySize: data.partySize, quotedMinutes: data.quotedMinutes }),
    onSuccess: (_, data) => {
      reset({ name: "", partySize: 2, quotedMinutes: 15 });
      toast.success(t("waitlist.addedToast", { name: data.name.trim() }));
      invalidate();
    },
    onError: () => {
      toast.error(t("waitlist.couldNotAdd"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "notified" | "left" | "seated" }) =>
      waitlistService.setStatus(id, status),
    onSuccess: () => {
      invalidate();
    },
  });

  const active = (entries ?? []).filter((e) => e.status === "waiting" || e.status === "notified");
  const history = (entries ?? []).filter((e) => e.status !== "waiting" && e.status !== "notified");

  const onJoin = handleSubmit(async (data) => {
    joinMutation.mutate(data);
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {entries === undefined ? (
          <ListSkeleton rows={3} rowHeight="h-16" />
        ) : active.length === 0 ? (
          <EmptyState icon={Users} title={t("waitlist.emptyTitle")} description={t("waitlist.emptyDesc")} />
        ) : (
          <div className="space-y-2">
            {active.map((entry) => {
              const elapsed = Math.round((nowMs - new Date(entry.joinedAt).getTime()) / 60_000);
              const over = elapsed > entry.quotedMinutes;
              return (
                <Card key={entry.id} className={cn(over && "border-amber-500/40")}>
                  <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        #{entry.position ?? "—"} {entry.name} <span className="font-normal text-muted-foreground">— {t("waitlist.partyOf", { count: entry.partySize })}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("waitlist.elapsed", { elapsed, quoted: entry.quotedMinutes })} · {STATUS_LABEL[entry.status]}
                        {entry.phone && ` · ${entry.phone}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {entry.status === "waiting" && (
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: entry.id, status: "notified" })}>{t("waitlist.notify")}</Button>
                      )}
                      <Button size="sm" onClick={() => statusMutation.mutate({ id: entry.id, status: "seated" })}>{t("waitlist.seat")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: entry.id, status: "left" })}>{t("waitlist.leave")}</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <p className="text-xs font-medium text-muted-foreground">{t("waitlist.earlierTonight")}</p>
            {history.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>{entry.name} · {t("waitlist.partyOf", { count: entry.partySize })}</span>
                <span className="text-xs text-muted-foreground">{STATUS_LABEL[entry.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm font-medium">{t("waitlist.addWalkIn")}</p>
          <form onSubmit={onJoin} className="space-y-3">
          <Input placeholder={t("waitlist.name")} {...register("name")} />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs">{t("waitlist.party")}</Label>
            <Button type="button" variant="outline" size="icon" className="size-9" onClick={() => setValue("partySize", Math.max(1, partySize - 1))}>
              <Minus className="size-4" />
            </Button>
            <span className="w-6 text-center tabular-nums">{partySize}</span>
            <Button type="button" variant="outline" size="icon" className="size-9" onClick={() => setValue("partySize", partySize + 1)}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs">{t("waitlist.quote")}</Label>
            <div className="flex gap-1.5">
              {QUOTE_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={quotedMinutes === m ? "default" : "outline"}
                  onClick={() => setValue("quotedMinutes", m)}
                >
                  <Clock className="size-3.5" /> {m}m
                </Button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting || joinMutation.isPending}>
            <UserPlus className="size-4" /> {t("waitlist.addToWaitlist")}
          </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
