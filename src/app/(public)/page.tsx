import { permanentRedirect } from "next/navigation";
import LandingPage from "@/components/landing/landing-page";
import { isDemoMode } from "@/features/shared/app-mode";

export default function Home() {
  // The demo build's home is the tour — a permanent server-side redirect so
  // search engines consolidate the demo's root into /demo. The marketing
  // landing lives on the live app and gets its own SEO pass.
  if (isDemoMode()) permanentRedirect("/demo");
  return <LandingPage />;
}
