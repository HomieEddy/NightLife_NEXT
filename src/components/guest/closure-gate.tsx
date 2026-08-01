"use client";

/**
 * Blocks the ordering surfaces (menu / cart / gift) once the guest has asked to
 * close the tab. Re-checks the session server-side on mount so typing the URL
 * (or stale client state) can't outrun the truth — the order service rejects
 * regardless; this gate is the friendly layer.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useGuest } from "@/context/guest-context";
import { guestsService } from "@/features/guests/services";
import { cn } from "@/features/shared/utils";
import type { ReactNode } from "react";

export function ClosureGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { sessionId, closureStatus, setClosureStatus } = useGuest();
  const [phase, setPhase] = useState<"active" | "fading" | "blocked">("active");

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
    if (closureStatus === "requested" && phase === "active") {
      setPhase("fading");
      const t = setTimeout(() => setPhase("blocked"), 300);
      return () => clearTimeout(t);
    }
  }, [closureStatus, phase]);

  useEffect(() => {
    if (closureStatus === "closed") router.replace("/guest/receipt");
  }, [closureStatus, router]);

  if (closureStatus === "closed") return null; // redirecting to the receipt

  if (phase === "blocked") {
    return (
      <div className="p-6 animate-fade-up">
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

  return (
    <div className={cn("transition-opacity duration-300", phase === "fading" ? "opacity-0" : "opacity-100")}>
      {children}
    </div>
  );
}
