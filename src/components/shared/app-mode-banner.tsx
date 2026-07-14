import { SandboxBanner } from "@/components/demo/sandbox-banner";
import { isDemoMode } from "@/lib/app-mode";

export function AppModeBanner() {
  return isDemoMode() ? <SandboxBanner /> : null;
}
