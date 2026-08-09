"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Gift, GlassWater, Hand, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { useGuest } from "@/context/guest-context";
import { guestsService } from "@/features/guests/services";
import { cn } from "@/features/shared/utils";
import type { HelpRequestType } from "@/lib/types";

export default function GuestHelpPage() {
  const t = useTranslations("guest.help");
  const { table, guestName, sessionId } = useGuest();
  const [sending, setSending] = useState<HelpRequestType | null>(null);

  const HELP_OPTIONS = useMemo(() => [
    { type: "call-waiter" as HelpRequestType, label: t("callWaiter"), description: t("callWaiterDesc"), icon: Hand },
    { type: "refill-ice" as HelpRequestType, label: t("refillIce"), description: t("refillIceDesc"), icon: GlassWater },
    { type: "clean-table" as HelpRequestType, label: t("cleanTable"), description: t("cleanTableDesc"), icon: Sparkles },
    { type: "security" as HelpRequestType, label: t("security"), description: t("securityDesc"), icon: Shield },
  ], [t]);

  async function requestHelp(type: HelpRequestType, label: string) {
    if (!table) {
      toast.error(t("joinTableFirst"));
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
    toast.success(t("requestSentToast", { label }));
  }

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <PageHeader
        title={t("heading")}
        description={t("subtitle")}
      />
      <div className="space-y-2.5 stagger-children">
        {HELP_OPTIONS.map((option) => (
          <ConfirmDialog
            key={option.type}
            title={`${option.label}?`}
            description={
              option.type === "security"
                ? t("securityConfirmDesc")
                : t("notifiedInstantly", { desc: option.description })
            }
            confirmLabel={t("sendRequest")}
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
                {sending === option.type ? t("sending") : option.label}
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
          <p className="font-medium">{t("sendBottle")}</p>
          <p className="text-xs text-muted-foreground">
            {t("sendBottleDesc")}
          </p>
        </div>
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        {t("appearInstantly")}
      </p>
    </div>
  );
}
