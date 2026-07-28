import { SandboxBanner } from "@/components/demo/sandbox-banner";
import { isDemoMode } from "@/features/shared/app-mode";

export function AppModeBanner() {
  return isDemoMode() ? <SandboxBanner /> : null;
}
