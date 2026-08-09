import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LocaleToggle } from "@/components/shared/locale-toggle";

/** Public events embed. Supports ?lang=fr/en to set the locale cookie on arrival (src/proxy.ts). */
export default function PublicEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="absolute right-2 top-2 z-50">
        <ThemeToggle />
        <LocaleToggle />
      </div>
      <main className="flex-1">{children}</main>
    </div>
  );
}
