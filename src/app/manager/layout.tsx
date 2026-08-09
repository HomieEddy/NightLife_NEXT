import type { Metadata } from "next";
import { isDemoMode } from "@/features/shared/app-mode";
import { requireArea } from "@/features/platform/auth-helpers";
import { ManagerShell } from "@/components/manager/manager-shell";
import { AttentionProvider } from "@/lib/attention-provider";

// Product UI is never index-worthy, in either build.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Server guard: live mode rejects direct URL entry without a manager-area
// session (owner/admin org role). The demo sandbox keeps its client-side gate.
export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) await requireArea("manager");
  return (
    <AttentionProvider>
      <ManagerShell>{children}</ManagerShell>
    </AttentionProvider>
  );
}
