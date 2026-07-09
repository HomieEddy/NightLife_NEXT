"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hourglass, Loader2, PartyPopper, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ClubLights } from "@/components/fx/club-lights";
import { useGuest } from "@/context/guest-context";
import { mockGuestsService } from "@/lib/mock-services/guests-service";

/**
 * Waiting room: in production this screen listens for the host's approval.
 * TODO(backend): subscribe to session status over WebSocket instead of the
 * "simulate approval" button.
 */
export default function WaitingPage() {
  const router = useRouter();
  const { table, guestName, sessionId, approved, approve } = useGuest();
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (approved) router.replace("/guest/menu");
  }, [approved, router]);

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

  if (approved) return null;

  async function simulateApproval() {
    setApproving(true);
    await mockGuestsService.setSessionStatus(sessionId!, "approved");
    approve();
    router.push("/guest/menu");
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-6 text-center animate-fade-in">
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

      <div className="relative mt-4 w-full max-w-xs space-y-2 rounded-xl border border-dashed bg-background/60 p-4 backdrop-blur animate-fade-up">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prototype control
        </p>
        <Button className="w-full" onClick={simulateApproval} disabled={approving}>
          <PartyPopper className="size-4" />
          {approving ? "Approving…" : "Simulate host approval"}
        </Button>
        <p className="text-xs text-muted-foreground">
          In the real product a host taps “approve” on the staff panel.
        </p>
      </div>
    </div>
  );
}
