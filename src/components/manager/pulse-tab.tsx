"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Megaphone, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityChip } from "@/components/shared/entity-chip";
import { cn } from "@/features/shared/utils";
import type { AttentionItem, AttentionItemType } from "@/lib/types";
import type { EntityChipType } from "@/components/shared/entity-chip";

/** Most attention items link to their table; the three door-side ones link elsewhere. */
function chipFor(item: AttentionItem): { type: EntityChipType; id: string } {
  const byType: Partial<Record<AttentionItemType, EntityChipType>> = {
    "capacity-warning": "door",
    "waitlist-overdue": "waitlist",
    "incident-open": "incident",
  };
  const type = byType[item.type] ?? "table";
  const id = type === "incident" ? item.id.replace(/^incident-/, "") : item.tableId;
  return { type, id };
}

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
  const t = useTranslations("shared");
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
              <PartyPopper className="size-4 text-primary" /> {t("pulse.lastCall")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lastCallActive
                ? t("pulse.lastCallActiveDesc")
                : t("pulse.lastCallInactiveDesc")}
            </p>
            <ConfirmDialog
              trigger={
                <Button
                  variant={lastCallActive ? "outline" : "default"}
                  disabled={togglingLastCall}
                  className="w-full"
                >
                  {lastCallActive ? t("pulse.endLastCall") : t("pulse.startLastCall")}
                </Button>
              }
              title={lastCallActive ? t("pulse.endLastCallTitle") : t("pulse.startLastCallTitle")}
              description={
                lastCallActive
                  ? t("pulse.endLastCallDesc")
                  : t("pulse.startLastCallDesc")
              }
              confirmLabel={lastCallActive ? t("pulse.endLastCall") : t("pulse.startLastCall")}
              onConfirm={handleToggle}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-primary" /> {t("pulse.broadcast")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={t("pulse.broadcastPlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
            <ConfirmDialog
              trigger={
                <Button disabled={sending || !message.trim()} className="w-full">
                  {sending ? t("pulse.sending") : t("pulse.sendToAllStaff")}
                </Button>
              }
              title={t("pulse.sendBroadcastTitle")}
              description={t("pulse.sendBroadcastDesc")}
              confirmLabel={t("pulse.sendBroadcast")}
              onConfirm={handleSend}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pulse.needsAttention")}</CardTitle>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <p className="text-sm text-muted-foreground">{t("actions.loading")}</p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title={t("pulse.floorCalm")}
              description={t("pulse.nothingNeedsAttention")}
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
                      <EntityChip {...chipFor(item)} label={item.tableCode} />
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
