import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { LangParamHandler } from "@/components/shared/lang-param-handler";

/**
 * Minimal shell for the public reservation embed page.
 * No nav chrome so it works inside an iframe. Supports ?lang=fr/en to set the
 * locale cookie on arrival, so a venue's French website can embed with ?lang=fr.
 */
export default function ReservationEmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <LangParamHandler />
      <div className="absolute right-2 top-2 z-50">
        <ThemeToggle />
        <LocaleToggle />
      </div>
      <main className="flex-1">{children}</main>
    </div>
  );
}
