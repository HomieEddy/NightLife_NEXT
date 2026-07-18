"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, GlassWater, Hand, ReceiptEuro, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { useGuest } from "@/context/guest-context";
import { guestsService } from "@/lib/services/guests-service";
import { cn } from "@/lib/utils";
import type { HelpRequestType } from "@/lib/types";

const HELP_OPTIONS: {
  type: HelpRequestType;
  label: string;
  description: string;
  icon: typeof Hand;
}[] = [
  { type: "call-waiter", label: "Call a waiter", description: "Someone will come to your table", icon: Hand },
  { type: "refill-ice", label: "Refill ice & mixers", description: "Top up your bottle setup", icon: GlassWater },
  { type: "clean-table", label: "Clean the table", description: "We'll tidy things up", icon: Sparkles },
  { type: "security", label: "Security", description: "Discreet assistance, right away", icon: Shield },
];

export default function GuestHelpPage() {
  const { table, guestName, sessionId } = useGuest();
  const [sending, setSending] = useState<HelpRequestType | null>(null);
  const [closingTab, setClosingTab] = useState(false);

  async function requestHelp(type: HelpRequestType, label: string) {
    if (!table) {
      toast.error("Join a table first — scan the QR code.");
      return;
    }
    setSending(type);
    await guestsService.createHelpRequest({
      sessionId: sessionId ?? "",
      tableCode: table.tableCode,
      zoneName: table.zoneName,
      guestName: guestName || "Guest",
      type,
    });
    setSending(null);
    toast.success(`${label} — the team has been notified.`);
  }

  async function handleRequestBill() {
    if (!sessionId) {
      toast.error("No active session — scan the QR code first.");
      return;
    }
    setClosingTab(true);
    try {
      await guestsService.requestClosure(sessionId);
      toast.success("Tab closure requested — your host will settle it shortly.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not request the bill right now.",
      );
    } finally {
      setClosingTab(false);
    }
  }

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <PageHeader
        title="Need something?"
        description="One tap and the right person heads your way."
      />
      <div className="space-y-2.5 stagger-children">
        {HELP_OPTIONS.map((option) => (
          <ConfirmDialog
            key={option.type}
            title={`${option.label}?`}
            description={
              option.type === "security"
                ? "Security is notified discreetly and heads to your table."
                : `${option.description} — the team is notified instantly.`
            }
            confirmLabel="Send request"
            onConfirm={() => requestHelp(option.type, option.label)}
            trigger={
          <button
            type="button"
            disabled={sending !== null}
            className={cn(
              "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
              "hover:border-primary/50 active:bg-accent/50 disabled:opacity-60",
              option.type === "security" && "border-red-500/30",
            )}
          >
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg",
                option.type === "security"
                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                  : "bg-primary/15 text-primary",
              )}
            >
              <option.icon className="size-5" />
            </div>
            <div>
              <p className="font-medium">
                {sending === option.type ? "Sending…" : option.label}
              </p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
          </button>
            }
          />
        ))}

        <ConfirmDialog
          title="Request the bill?"
          description="This closes your tab — you won't be able to place new orders until the host settles it."
          confirmLabel="Close my tab"
          onConfirm={handleRequestBill}
          trigger={
            <button
              type="button"
              disabled={closingTab}
              className="flex w-full items-center gap-4 rounded-xl border border-amber-500/30 p-4 text-left transition-colors hover:border-amber-500/50 active:bg-accent/50 disabled:opacity-60"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <ReceiptEuro className="size-5" />
              </div>
              <div>
                <p className="font-medium">{closingTab ? "Requesting…" : "Request the bill"}</p>
                <p className="text-xs text-muted-foreground">Close out your tab</p>
              </div>
            </button>
          }
        />
      </div>

      <Link
        href="/guest/gift"
        className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:border-primary/50"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Gift className="size-5" />
        </div>
        <div>
          <p className="font-medium">Send a bottle to another table</p>
          <p className="text-xs text-muted-foreground">
            Surprise someone — it&apos;s on your tab, they just get the delivery
          </p>
        </div>
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        Requests appear instantly on the staff panel.
      </p>
    </div>
  );
}
