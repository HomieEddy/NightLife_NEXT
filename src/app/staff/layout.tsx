import { isDemoMode } from "@/lib/app-mode";
import { requireArea } from "@/server/auth-helpers";
import { StaffShell } from "@/components/staff/staff-shell";

// Server guard: live mode rejects direct URL entry without a staff-area
// session (any org member). The demo sandbox keeps its client-side gate.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) await requireArea("staff");
  return <StaffShell>{children}</StaffShell>;
}
