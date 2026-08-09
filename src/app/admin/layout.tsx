import type { Metadata } from "next";
import { AdminLayout } from "@/components/shared/admin-surface";

// Product UI is never index-worthy, in either build.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default AdminLayout;
