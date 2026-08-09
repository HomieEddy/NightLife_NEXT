import type { Metadata } from "next";
import { isDemoMode } from "@/features/shared/app-mode";
import { requireArea } from "@/features/platform/auth-helpers";
import { StaffShell } from "@/components/staff/staff-shell";

// Product UI is never index-worthy, in either build.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Server guard: live mode rejects direct URL entry without a staff-area
// session (any org member). The demo sandbox keeps its client-side gate.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) await requireArea("staff");
  return <StaffShell>{children}</StaffShell>;
}
