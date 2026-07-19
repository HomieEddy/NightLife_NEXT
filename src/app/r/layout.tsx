import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Minimal shell for the public reservation embed page.
 * No nav chrome so it works inside an iframe.
 */
export default function ReservationEmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="absolute right-2 top-2 z-50">
        <ThemeToggle />
      </div>
      <main className="flex-1">{children}</main>
    </div>
  );
}
