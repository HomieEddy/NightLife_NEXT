import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { isDemoMode } from "@/lib/app-mode";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  ...(isDemoMode() ? [{ href: "/demo", label: "Live demo" }] : []),
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <BrandLogo />
          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV_LINKS.map((link) => (
              <Button key={link.href} variant="ghost" size="sm" asChild>
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
            {isDemoMode() && (
              <Button size="sm" asChild>
                <Link href="/lead">Get started</Link>
              </Button>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <BrandLogo className="text-sm" />
          <p>© {new Date().getFullYear()} NightLifeNext.</p>
          <div className="flex gap-4">
            {isDemoMode() && (
              <Link href="/demo" className="hover:text-foreground">
                Demo tour
              </Link>
            )}
            {isDemoMode() && (
              <Link href="/g/demo-table" className="hover:text-foreground">
                Guest demo
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
