"use client";

import { GlassWater } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { guestsService } from "@/lib/services/guests-service";
import { ordersService } from "@/lib/services/orders-service";
import { formatMoney } from "@/lib/format";
import { splitSessionByItems } from "@/lib/tab";
import { countDeliveredAlcoholicDrinks } from "@/lib/door";
import type { GuestSession, MenuItem, Order, VenueTable } from "@/lib/types";

/**
 * Transfer / merge / split-by-item for one session — the tab's mobility
 * model (plan 16). Splitting never creates new orders, it only produces a
 * per-guest receipt view over the session's existing balance.
 */
export function SessionActionsDialog({
  session,
  orders,
  tables,
  otherOpenSessions,
  canTransfer,
  canMerge,
  canRefuseService = false,
  menuItems = [],
  authorStaffId,
  authorStaffName,
  onDone,
  trigger,
}: {
  session: GuestSession;
  orders: Order[];
  tables: VenueTable[];
  otherOpenSessions: GuestSession[];
  canTransfer: boolean;
  canMerge: boolean;
  /** Responsible-service tab: drink counter + refuse-further-service (plan 17). */
  canRefuseService?: boolean;
  menuItems?: MenuItem[];
  authorStaffId: string;
  authorStaffName: string;
  onDone: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [toTableId, setToTableId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [guestCount, setGuestCount] = useState(session.partySize || 2);
  const [refuseReason, setRefuseReason] = useState("");
  const [busy, setBusy] = useState(false);

  const drinkCount = useMemo(
    () => countDeliveredAlcoholicDrinks(orders, menuItems, session.id),
    [orders, menuItems, session.id],
  );

  const availableTables = useMemo(
    () => tables.filter((t) => t.id !== session.tableId && t.status === "open"),
    [tables, session.tableId],
  );

  const shares = useMemo(
    () => splitSessionByItems(orders, [], Math.max(1, guestCount)),
    [orders, guestCount],
  );

  async function transfer() {
    const target = availableTables.find((t) => t.id === toTableId);
    if (!target) return;
    setBusy(true);
    try {
      await guestsService.transferSession(
        session.id, target.id, target.code, session.zoneName, authorStaffId, authorStaffName,
      );
      toast.success(`${session.displayName}'s tab moved to ${target.code}`);
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not transfer this tab");
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    const parent = otherOpenSessions.find((s) => s.id === mergeTargetId);
    if (!parent) return;
    setBusy(true);
    try {
      await ordersService.reassignOrdersToSession(session.id, parent.id);
      await guestsService.mergeSession(session.id, parent.id, authorStaffId, authorStaffName);
      toast.success(`Merged into ${parent.displayName}'s tab (${parent.tableCode})`);
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not merge these tabs");
    } finally {
      setBusy(false);
    }
  }

  async function refuseService() {
    if (!refuseReason.trim()) return;
    setBusy(true);
    try {
      await guestsService.refuseService(session.id, refuseReason.trim(), authorStaffId, authorStaffName);
      toast.success(`Service refused for ${session.displayName} — incident logged`);
      setRefuseReason("");
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refuse service");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{session.displayName}&apos;s tab</DialogTitle>
          <DialogDescription>{session.tableCode} · {session.zoneName}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="transfer">
          <TabsList className="w-full">
            <TabsTrigger value="transfer" disabled={!canTransfer}>Transfer</TabsTrigger>
            <TabsTrigger value="merge" disabled={!canMerge}>Merge</TabsTrigger>
            <TabsTrigger value="split">Split</TabsTrigger>
            <TabsTrigger value="service">Service</TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-table">Move to table</Label>
              <Select value={toTableId} onValueChange={setToTableId}>
                <SelectTrigger id="transfer-table" className="w-full">
                  <SelectValue placeholder="Choose an open table…" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.code} · {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              The minimum-spend commitment travels with the party unchanged.
            </p>
            <DialogFooter>
              <ConfirmDialog
                trigger={<Button disabled={!toTableId || busy} className="w-full">Transfer</Button>}
                title={`Move ${session.displayName}'s tab to ${availableTables.find((t) => t.id === toTableId)?.code ?? "…"}?`}
                description={`${session.tableCode} becomes open. Both table statuses update immediately.`}
                confirmLabel="Transfer"
                onConfirm={transfer}
              />
            </DialogFooter>
          </TabsContent>

          <TabsContent value="merge" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="merge-target">Merge into</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger id="merge-target" className="w-full">
                  <SelectValue placeholder="Choose the other tab…" />
                </SelectTrigger>
                <SelectContent>
                  {otherOpenSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.displayName} — {s.tableCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              This tab&apos;s orders move to the other session; the higher of the two minimums applies.
            </p>
            <DialogFooter>
              <ConfirmDialog
                trigger={<Button disabled={!mergeTargetId || busy} className="w-full">Merge</Button>}
                title={`Merge ${session.displayName}'s tab into ${otherOpenSessions.find((s) => s.id === mergeTargetId)?.displayName ?? "…"}'s?`}
                description="This tab closes as merged and its orders re-point to the parent — no new orders are created."
                confirmLabel="Merge"
                onConfirm={merge}
              />
            </DialogFooter>
          </TabsContent>

          <TabsContent value="split" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="split-count">Split evenly across</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setGuestCount((n) => Math.max(2, n - 1))}>−</Button>
                <span className="w-10 text-center tabular-nums">{guestCount}</span>
                <Button type="button" variant="outline" size="icon" onClick={() => setGuestCount((n) => Math.min(12, n + 1))}>+</Button>
                <span className="text-sm text-muted-foreground">guests</span>
              </div>
            </div>
            <ul className="space-y-1 rounded-lg border p-2 text-sm">
              {shares.map((cents, i) => (
                <li key={i} className="flex justify-between tabular-nums">
                  <span className="text-muted-foreground">Guest {i + 1}</span>
                  <span className="font-medium">{formatMoney(cents / 100)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              A view only — splitting never creates new orders or changes the tab&apos;s balance.
            </p>
          </TabsContent>

          <TabsContent value="service" className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-sm">
                <GlassWater className="size-4 text-primary" /> Delivered alcoholic drinks
              </p>
              <span className="text-lg font-semibold tabular-nums">{drinkCount}</span>
            </div>
            {session.serviceRefusedAt ? (
              <p className="text-xs text-muted-foreground">
                Service already refused — {session.serviceRefusedReason}
              </p>
            ) : canRefuseService ? (
              <div className="space-y-2">
                <Label htmlFor="refuse-reason">Refuse further service</Label>
                <Textarea
                  id="refuse-reason"
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  placeholder="Why is service being refused?"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Blocks new orders for this session and logs an incident.
                </p>
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" className="w-full" disabled={!refuseReason.trim() || busy}>
                      Refuse further service
                    </Button>
                  }
                  title={`Refuse further service to ${session.displayName}?`}
                  description="New orders are blocked for this session immediately and an incident is filed."
                  confirmLabel="Refuse service"
                  destructive
                  onConfirm={refuseService}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only staff with the service:refuse capability can refuse further service.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
