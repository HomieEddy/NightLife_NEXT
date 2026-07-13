"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hourglass, Loader2, PartyPopper, QrCode, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ClubLights } from "@/components/fx/club-lights";
import { useGuest } from "@/context/guest-context";
import { isDemoMode } from "@/lib/app-mode";
import { guestsService } from "@/lib/services/guests-service";

export default function WaitingPage() {
  const router = useRouter();
  const { table, guestName, sessionId, approved, approve } = useGuest();
  const [approving, setApproving] = useState(false);

  const pollApproval = useCallback(async () => {
    if (!sessionId || approved) return;
    const session = await guestsService.getSession(sessionId);
    if (session?.status === "approved") approve();
    if (session?.status === "denied") router.replace("/g/demo-table");
  }, [sessionId, approved, approve, router]);

  useEffect(() => {
    if (isDemoMode()) return;
    pollApproval();
    const interval = setInterval(pollApproval, 4000);
    return () => clearInterval(interval);
  }, [pollApproval]);

  if (!table || !sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={QrCode}
          title="No table joined"
          description="Scan the QR code on your table to get started."
          action={
            <Button asChild>
              <Link href="/g/demo-table">Simulate scanning a QR</Link>
            </Button>
          }
        />
      </div>
    );
  }

  async function simulateApproval() {
    setApproving(true);
    await guestsService.setSessionStatus(sessionId!, "approved");
    approve();
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-6 text-center animate-fade-in">
      {approved ? (
        <Dialog open>
          <DialogContent showCloseButton={false} className="sm:max-w-sm">
            <DialogHeader className="items-center gap-3 pt-2 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-8 text-primary" />
              </div>
              <DialogTitle className="text-xl">Welcome, {guestName}!</DialogTitle>
              <DialogDescription className="max-w-xs text-balance">
                You&apos;re all set at <span className="font-semibold text-foreground">{table.tableCode}</span> in{" "}
                {table.zoneName}. Tap below to browse the menu and order.
              </DialogDescription>
            </DialogHeader>
            <div className="px-2 pb-4">
              <Button className="w-full" size="lg" onClick={() => router.replace("/guest/menu")}>
                Browse the menu
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {!approved && (
        <>
          <ClubLights density={160} speed={0.7} className="opacity-50" />
          <div className="relative animate-pop-in">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex size-24 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
              <Hourglass className="size-10 text-primary" />
            </div>
          </div>

          <div className="relative space-y-2 animate-fade-up">
            <h1 className="text-2xl font-semibold">Hang tight, {guestName}</h1>
            <p className="max-w-xs text-muted-foreground">
              Your host is confirming <span className="font-medium text-foreground">{table.tableCode}</span> in{" "}
              {table.zoneName}. This usually takes under a minute.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Waiting for approval…
          </div>

          {isDemoMode() && (
            <div className="relative mt-4 w-full max-w-xs space-y-2 rounded-xl border border-dashed bg-background/60 p-4 backdrop-blur animate-fade-up">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Prototype control
              </p>
              <Button className="w-full" onClick={simulateApproval} disabled={approving}>
                <PartyPopper className="size-4" />
                {approving ? "Approving…" : "Simulate host approval"}
              </Button>
              <p className="text-xs text-muted-foreground">
                In the real product a host taps &quot;approve&quot; on the staff panel.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
