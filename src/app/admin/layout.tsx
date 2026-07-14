"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Filter, LayoutDashboard, LockKeyhole, Rocket, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/shared/brand-logo";
import { RequireAuth } from "@/components/shared/require-auth";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AuthBanner } from "@/components/shared/auth-banner";
import { isDemoMode } from "@/lib/app-mode";
import { ADMIN_DEMO_PASSWORD, isAdminUnlocked, setAdminUnlocked } from "@/lib/admin-gate";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Lead pipeline", icon: Filter },
  { href: "/admin/venues", label: "Tenants", icon: Building2 },
  { href: "/admin/onboarding", label: "Provisioning", icon: Rocket },
];

function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof window === "undefined") return;
    if (password === ADMIN_DEMO_PASSWORD) {
      setAdminUnlocked(true);
      onUnlock();
    } else {
      toast.error("Wrong password.");
      setPassword("");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-background to-muted/40">
      <header className="flex h-14 items-center justify-between px-4">
        <BrandLogo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-1 text-center">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                <LockKeyhole className="size-5" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight">Platform admin</h1>
              <p className="text-sm text-muted-foreground">
                This area is restricted in the live demo. Enter the access password to continue.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="off"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!password.trim()}>
                <LockKeyhole className="size-4" /> Unlock
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              Not part of the tour?{" "}
              <Link href="/demo" className="text-primary hover:underline">
                Back to the live demo
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const demo = isDemoMode();
  const [unlocked, setUnlocked] = useState<boolean | null>(demo ? null : true);
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  useEffect(() => {
    if (!demo) return;
    setUnlocked(isAdminUnlocked());
  }, [demo]);

  if (unlocked === null) return <RequireAuth><div /></RequireAuth>;
  if (!unlocked) return <RequireAuth><AdminGate onUnlock={() => setUnlocked(true)} /></RequireAuth>;

  return (
    <RequireAuth>
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BrandLogo href="/admin" />
            <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              <ShieldCheck className="size-3" /> Platform admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AuthBanner />
            <ThemeToggle />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
    </RequireAuth>
  );
}
