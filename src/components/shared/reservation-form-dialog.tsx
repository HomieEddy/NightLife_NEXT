"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, UserSquare2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { guestService } from "@/features/sessions/services";
import { formatMoney } from "@/features/shared/format";
import { z } from "zod";
import type { GuestProfile, StaffMember, VenueEvent, Zone, VenueTable } from "@/lib/types";

export type ReservationDraft = {
  guestName: string;
  partySize: number;
  zoneId: string;
  tableId: string;
  startsAt: string;
  endsAt: string;
  note: string;
  promoterId?: string;
  eventId?: string;
  guestProfileId?: string;
  celebration?: "birthday" | "anniversary" | "other";
  depositCents?: number;
  cancellationDeadlineTime?: string;
  holdUntil?: string;
  minimumSpendCents?: number;
  expectedDurationMinutes?: number;
  timeSlot?: "early" | "late" | "any";
};

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

export const EMPTY_DRAFT: ReservationDraft = {
  guestName: "",
  partySize: 2,
  zoneId: "",
  tableId: "",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: "",
  note: "",
};

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const zReservationForm = z.object({
  guestName: z.string().min(1),
  partySize: z.number().int().min(1),
  zoneId: z.string().default(""),
  tableId: z.string().default(""),
  startsAt: z.string().default(toLocalInput(new Date().toISOString())),
  endsAt: z.string().default(""),
  note: z.string().default(""),
  eventId: z.string().optional(),
  promoterId: z.string().optional(),
  celebration: z.string().optional(),
  depositCents: z.string().default(""),
  cancellationDeadlineTime: z.string().default(""),
  holdUntil: z.string().default(""),
  minimumSpendCents: z.string().default(""),
  expectedDurationMinutes: z.string().default(""),
  timeSlot: z.string().default("any"),
});

const ZFORM_EMPTY = {
  guestName: "",
  partySize: 2,
  zoneId: "",
  tableId: "",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: "",
  note: "",
};

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReservationDraft;
  setDraft: (draft: ReservationDraft) => void;
  zones: Zone[];
  tablesForZone: VenueTable[];
  onSave: () => unknown;
  editingId: string | null;
  promoters?: StaffMember[];
  events?: VenueEvent[];
}

export function ReservationFormDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  zones,
  tablesForZone,
  onSave,
  editingId,
  promoters,
  events,
}: ReservationFormDialogProps) {
  const t = useTranslations("shared");
  const [candidates, setCandidates] = useState<GuestProfile[]>([]);
  const linkedProfile = candidates.find((c) => c.id === draft.guestProfileId);
  const [saving, setSaving] = useState(false);

  const CELEBRATION_OPTIONS = [
    { value: "" as const, label: t("reservationForm.none") },
    { value: "birthday" as const, label: t("reservationForm.birthday") },
    { value: "anniversary" as const, label: t("reservationForm.anniversary") },
    { value: "other" as const, label: t("reservationForm.other") },
  ];

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(zReservationForm) as unknown as ReturnType<typeof zodResolver>,
    defaultValues: ZFORM_EMPTY,
  });

  useEffect(() => {
    if (!open || draft.guestProfileId || draft.guestName.trim().length < 3) {
      setCandidates([]);
      return;
    }
    const [firstName, ...rest] = draft.guestName.trim().split(/\s+/);
    const timeout = setTimeout(() => {
      guestService.findCandidates({ firstName, lastName: rest.join(" ") || undefined }).then(setCandidates);
    }, 300);
    return () => clearTimeout(timeout);
  }, [draft.guestName, open, draft.guestProfileId]);

  const onSubmit = handleSubmit(async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? t("reservationForm.editTitle") : t("reservationForm.newTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-name">{t("reservationForm.guestName")}</Label>
            <Input
              id="res-name"
              value={draft.guestName}
              onChange={(e) => setDraft({ ...draft, guestName: e.target.value, guestProfileId: undefined })}
              placeholder={t("reservationForm.guestNamePlaceholder")}
            />
            {linkedProfile ? (
              <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs">
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-primary" /> {t("reservationForm.linkedTo")} {linkedProfile.displayName}
                  {linkedProfile.vipTier !== "none" && ` · ${linkedProfile.vipTier}`}
                  {" · "}{linkedProfile.visitCount} {t("reservationForm.visits")} · {formatMoney(linkedProfile.lifetimeNetCents / 100)}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setDraft({ ...draft, guestProfileId: undefined })}
                >
                  {t("reservationForm.notThem")}
                </button>
              </div>
            ) : (
              candidates.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("reservationForm.matchesExisting")}</p>
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, guestProfileId: c.id })}
                      className="flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/50"
                    >
                      <UserSquare2 className="size-3.5 shrink-0 text-muted-foreground" />
                      {c.displayName} — {t("reservationForm.nVisits", { count: c.visitCount })}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
          {events && events.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="res-event">{t("reservationForm.eventOptional")}</Label>
              <select
                id="res-event"
                className={selectCls}
                value={draft.eventId ?? ""}
                onChange={(e) => {
                  const eid = e.target.value || undefined;
                  const evt = eid ? events.find((ev) => ev.id === eid) : undefined;
                  setDraft({
                    ...draft,
                    eventId: eid,
                    ...(evt?.zoneId ? { zoneId: evt.zoneId, tableId: "" } : {}),
                    ...(evt ? { startsAt: toLocalInput(evt.startsAt), endsAt: toLocalInput(evt.endsAt) } : {}),
                  });
                }}
              >
                <option value="">{t("reservationForm.standaloneReservation")}</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-party">{t("reservationForm.partySize")}</Label>
              <Input
                id="res-party"
                type="number"
                min={1}
                value={draft.partySize}
                onChange={(e) => setDraft({ ...draft, partySize: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-zone">{t("reservationForm.zone")}</Label>
              <select
                id="res-zone"
                className={selectCls}
                value={draft.zoneId}
                onChange={(e) => setDraft({ ...draft, zoneId: e.target.value, tableId: "" })}
              >
                <option value="">{t("reservationForm.selectZone")}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-table">{t("reservationForm.tableOptional")}</Label>
            <select
              id="res-table"
              className={selectCls}
              value={draft.tableId}
              onChange={(e) => setDraft({ ...draft, tableId: e.target.value })}
            >
              <option value="">{t("reservationForm.noSpecificTable")}</option>
              {tablesForZone.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.label}
                </option>
              ))}
            </select>
          </div>
          {promoters && promoters.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="res-promoter">{t("reservationForm.promoterOptional")}</Label>
              <select
                id="res-promoter"
                className={selectCls}
                value={draft.promoterId ?? ""}
                onChange={(e) => setDraft({ ...draft, promoterId: e.target.value || undefined })}
              >
                <option value="">{t("reservationForm.noPromoter")}</option>
                {promoters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-start">{t("reservationForm.starts")}</Label>
              <Input
                id="res-start"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-end">{t("reservationForm.endsOptional")}</Label>
              <Input
                id="res-end"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-note">{t("reservationForm.note")}</Label>
            <Textarea
              id="res-note"
              rows={2}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder={t("reservationForm.notePlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-celebration">{t("reservationForm.celebration")}</Label>
              <select id="res-celebration" className={selectCls}
                value={draft.celebration ?? ""}
                onChange={(e) => setDraft({ ...draft, celebration: e.target.value as ReservationDraft["celebration"] || undefined })}>
                {CELEBRATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-deposit">{t("reservationForm.deposit")}</Label>
              <Input id="res-deposit" type="number" min={0} step={50} placeholder="0"
                value={draft.depositCents ? draft.depositCents / 100 : ""}
                onChange={(e) => setDraft({ ...draft, depositCents: Math.round(Number(e.target.value) * 100) || undefined })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-cancel-deadline">{t("reservationForm.cancelBy")}</Label>
              <Input id="res-cancel-deadline" type="datetime-local"
                value={draft.cancellationDeadlineTime ?? ""}
                onChange={(e) => setDraft({ ...draft, cancellationDeadlineTime: e.target.value || undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-hold-until">{t("reservationForm.holdUntil")}</Label>
              <Input id="res-hold-until" type="datetime-local"
                value={draft.holdUntil ?? ""}
                onChange={(e) => setDraft({ ...draft, holdUntil: e.target.value || undefined })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-min-spend">{t("reservationForm.minSpend")}</Label>
              <Input id="res-min-spend" type="number" min={0} step={50} placeholder={t("reservationForm.tableDefault")}
                value={draft.minimumSpendCents ? draft.minimumSpendCents / 100 : ""}
                onChange={(e) => setDraft({ ...draft, minimumSpendCents: Math.round(Number(e.target.value) * 100) || undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-duration">{t("reservationForm.duration")}</Label>
              <Input id="res-duration" type="number" min={30} step={30} max={480} placeholder="—"
                value={draft.expectedDurationMinutes ?? ""}
                onChange={(e) => setDraft({ ...draft, expectedDurationMinutes: Number(e.target.value) || undefined })} />
            </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-slot">{t("reservationForm.timeSlot")}</Label>
              <select id="res-slot" className={selectCls}
                value={draft.timeSlot ?? "any"}
                onChange={(e) => setDraft({ ...draft, timeSlot: e.target.value as ReservationDraft["timeSlot"] || undefined })}>
                <option value="any">{t("reservationForm.anyTime")}</option>
                <option value="early">{t("reservationForm.early")}</option>
                <option value="late">{t("reservationForm.late")}</option>
              </select>
            </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              {t("reservationForm.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? t("reservationForm.saving") : editingId ? t("actions.save") : t("reservationForm.create")}
            </Button>
          </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
