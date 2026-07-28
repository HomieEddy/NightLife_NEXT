import { requirePlatformAdmin } from "@/features/platform/auth-helpers";
import AdminShellClient from "@/components/shared/admin-shell-client";

export async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return <AdminShellClient>{children}</AdminShellClient>;
}

// The pages import from the service selector (not the mock directly), so
// they work identically in both builds — only the layout auth differs.
export { default as AdminOverviewPage } from "@/components/demo/admin-overview-page";
export { default as AdminLeadsPage } from "@/components/demo/admin-leads-page";
export { default as AdminOnboardingPage } from "@/components/demo/admin-onboarding-page";
export { default as AdminVenuesPage } from "@/components/demo/admin-venues-page";
export { default as AdminPlansPage } from "@/components/demo/admin-plans-page";
export { default as AdminSettingsPage } from "@/components/demo/admin-settings-page";
export { default as AdminTenantDetailPage } from "@/components/demo/admin-tenant-detail-page";
