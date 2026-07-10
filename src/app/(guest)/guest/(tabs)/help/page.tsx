"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, GlassWater, Hand, ReceiptEuro, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { useGuest } from "@/context/guest-context";
import { mockGuestsService } from "@/lib/mock-services/guests-service";
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
  { type: "bill", label: "Request the bill", description: "Close out your tab", icon: ReceiptEuro },
  { type: "security", label: "Security", description: "Discreet assistance, right away", icon: Shield },
];

export default function GuestHelpPage() {
  const { table, guestName } = useGuest();
  const [sending, setSending] = useState<HelpRequestType | null>(null);

  async function requestHelp(type: HelpRequestType, label: string) {
    if (!table) {
      toast.error("Join a table first — scan the QR code.");
      return;
    }
    setSending(type);
    await mockGuestsService.createHelpRequest({
      tableCode: table.tableCode,
      zoneName: table.zoneName,
      guestName: guestName || "Guest",
      type,
    });
    setSending(null);
    toast.success(`${label} — the team has been notified.`);
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
            Surprise someone — it's on your tab, they just get the delivery
          </p>
        </div>
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        Requests appear instantly on the staff panel.
      </p>
    </div>
  );
}
