import { isDemoMode } from "@/lib/app-mode";
import { requireArea } from "@/server/auth-helpers";
import { ManagerShell } from "@/components/manager/manager-shell";

// Server guard: live mode rejects direct URL entry without a manager-area
// session (owner/admin org role). The demo sandbox keeps its client-side gate.
export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) await requireArea("manager");
  return <ManagerShell>{children}</ManagerShell>;
}
