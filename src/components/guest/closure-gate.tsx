"use client";

/**
 * Blocks the ordering surfaces (menu / cart / gift) once the guest has asked to
 * close the tab. Re-checks the session server-side on mount so typing the URL
 * (or stale client state) can't outrun the truth — the order service rejects
 * regardless; this gate is the friendly layer.
 */
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useGuest } from "@/context/guest-context";
import { guestsService } from "@/lib/services/guests-service";
import type { ReactNode } from "react";

export function ClosureGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { sessionId, closureStatus, setClosureStatus } = useGuest();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    guestsService.getSession(sessionId).then((session) => {
      if (cancelled || !session) return;
      if (session.status === "closed") setClosureStatus("closed");
      else if (session.status === "closure-requested") setClosureStatus("requested");
    }).catch(() => {
      // Session lookup is best-effort here; the order service still enforces.
    });
    return () => { cancelled = true; };
  }, [sessionId, setClosureStatus]);

  useEffect(() => {
    if (closureStatus === "closed") router.replace("/guest/receipt");
  }, [closureStatus, router]);

  if (closureStatus === "requested") {
    return (
      <div className="p-6">
        <EmptyState
          icon={ReceiptText}
          title="Tab closure requested"
          description="Ordering is paused while your host settles the tab. You can still track your orders."
          action={
            <Button asChild>
              <Link href="/guest/orders">View your orders</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (closureStatus === "closed") return null; // redirecting to the receipt

  return <>{children}</>;
}
