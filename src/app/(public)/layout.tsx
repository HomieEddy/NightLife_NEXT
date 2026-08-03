import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { DemoPublicFooter, DemoPublicNav } from "@/components/shared/demo-links";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { isDemoMode } from "@/features/shared/app-mode";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-gold/20 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <BrandLogo href={isDemoMode() ? "/demo" : "/"} />
          <nav className="flex items-center gap-1 sm:gap-2">
            {!isDemoMode() && (
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/pricing">Pricing</Link>
              </Button>
            )}
            <DemoPublicNav />
            <ThemeToggle />
            <LocaleToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <BrandLogo href={isDemoMode() ? "/demo" : "/"} className="text-sm" />
          <p>© {new Date().getFullYear()} NightLifeNext.</p>
          <DemoPublicFooter />
        </div>
      </footer>
    </div>
  );
}
