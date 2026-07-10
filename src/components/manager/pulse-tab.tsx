"use client";

import { useState } from "react";
import { AlertTriangle, Megaphone, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityChip } from "@/components/shared/entity-chip";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/lib/types";

/**
 * Presentational — the manager Dashboard owns polling/state so the tab
 * trigger can show a live item count without a second fetch loop.
 */
export function PulseTab({
  items,
  lastCallActive,
  onSendBroadcast,
  onToggleLastCall,
}: {
  items: AttentionItem[] | null;
  lastCallActive: boolean;
  onSendBroadcast: (message: string) => Promise<void>;
  onToggleLastCall: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingLastCall, setTogglingLastCall] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    await onSendBroadcast(message.trim());
    setMessage("");
    setSending(false);
  }

  async function handleToggle() {
    setTogglingLastCall(true);
    await onToggleLastCall();
    setTogglingLastCall(false);
  }

  const critical = items?.filter((i) => i.severity === "critical") ?? [];
  const warning = items?.filter((i) => i.severity === "warning") ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PartyPopper className="size-4 text-primary" /> Last call
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lastCallActive
                ? "New guest orders are blocked. Occupied tables show below if auto-flagging is on in Settings."
                : "Stops new guest orders venue-wide and nudges staff to start closing tables out."}
            </p>
            <ConfirmDialog
              trigger={
                <Button
                  variant={lastCallActive ? "outline" : "default"}
                  disabled={togglingLastCall}
                  className="w-full"
                >
                  {lastCallActive ? "End last call" : "Start last call"}
                </Button>
              }
              title={lastCallActive ? "End last call?" : "Start last call?"}
              description={
                lastCallActive
                  ? "Guests can place new orders again immediately."
                  : "Guests immediately stop being able to place new orders, and every staff device gets notified."
              }
              confirmLabel={lastCallActive ? "End last call" : "Start last call"}
              onConfirm={handleToggle}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-primary" /> Broadcast to staff
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="e.g. Clear the terrace exit, fire marshal is here"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
            <ConfirmDialog
              trigger={
                <Button disabled={sending || !message.trim()} className="w-full">
                  {sending ? "Sending…" : "Send to all staff"}
                </Button>
              }
              title="Send this broadcast?"
              description="Every /staff device shows it full-screen immediately, and it's posted to all chat channels."
              confirmLabel="Send broadcast"
              onConfirm={handleSend}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Floor is calm"
              description="Nothing needs attention right now."
            />
          ) : (
            <ul className="space-y-2">
              {[...critical, ...warning].map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 text-sm",
                    item.severity === "critical"
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-amber-500/30 bg-amber-500/5",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <EntityChip type="table" id={item.tableId} label={item.tableCode} />
                      {item.zoneName && (
                        <span className="text-xs text-muted-foreground">{item.zoneName}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate">{item.message}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 capitalize",
                      item.severity === "critical"
                        ? "border-red-500/40 text-red-600 dark:text-red-400"
                        : "border-amber-500/40 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {item.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
