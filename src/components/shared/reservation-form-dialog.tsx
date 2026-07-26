"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Zone, VenueTable } from "@/lib/types";

export type ReservationDraft = {
  guestName: string;
  partySize: number;
  zoneId: string;
  tableId: string;
  startsAt: string;
  endsAt: string;
  note: string;
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

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReservationDraft;
  setDraft: (draft: ReservationDraft) => void;
  zones: Zone[];
  tablesForZone: VenueTable[];
  saving: boolean;
  onSave: () => void;
  editingId: string | null;
}

export function ReservationFormDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  zones,
  tablesForZone,
  saving,
  onSave,
  editingId,
}: ReservationFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit reservation" : "New reservation"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-name">Guest name</Label>
            <Input
              id="res-name"
              value={draft.guestName}
              onChange={(e) => setDraft({ ...draft, guestName: e.target.value })}
              placeholder="e.g. Jean Dupont"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-party">Party size</Label>
              <Input
                id="res-party"
                type="number"
                min={1}
                value={draft.partySize}
                onChange={(e) => setDraft({ ...draft, partySize: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-zone">Zone</Label>
              <select
                id="res-zone"
                className={selectCls}
                value={draft.zoneId}
                onChange={(e) => setDraft({ ...draft, zoneId: e.target.value, tableId: "" })}
              >
                <option value="">Select zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-table">Table (optional)</Label>
            <select
              id="res-table"
              className={selectCls}
              value={draft.tableId}
              onChange={(e) => setDraft({ ...draft, tableId: e.target.value })}
            >
              <option value="">No specific table</option>
              {tablesForZone.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-start">Starts</Label>
              <Input
                id="res-start"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-end">Ends (optional)</Label>
              <Input
                id="res-end"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-note">Note</Label>
            <Textarea
              id="res-note"
              rows={2}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Birthday, VIP client, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : editingId ? "Save" : "Create reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
