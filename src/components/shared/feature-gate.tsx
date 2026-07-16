"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FEATURE_CATALOG } from "@/lib/plan-catalog";
import { useEntitlements } from "@/lib/use-entitlements";
import type { FeatureKey } from "@/lib/types";

/**
 * Client-side plan gate for a whole page. UX only — server-side entitlement
 * enforcement is plan 10's live-track work.
 */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { plan, hasFeature } = useEntitlements();

  // While loading (or in the live build) the gate stays open.
  if (plan === null || hasFeature(feature)) return <>{children}</>;

  const def = FEATURE_CATALOG.find((f) => f.key === feature);
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <EmptyState
        icon={Lock}
        title={`${def?.label ?? feature} isn't in your plan`}
        description={`${def?.description ?? ""} Upgrade to unlock it for your venue.`}
        action={
          <Button asChild>
            <Link href="/manager/subscription">View plans</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </div>
  );
}
