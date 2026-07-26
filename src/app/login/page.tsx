"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn, Sparkles, UserCog, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { authService } from "@/lib/services/auth-service";
import { isDemoMode } from "@/lib/app-mode";
import type { AuthUser } from "@/lib/types";

const ROLE_ICON: Record<string, typeof UserCog> = {
  manager: UserCog,
  staff: Users,
  admin: ShieldCheck,
};

const ROLE_HOME: Record<string, string> = {
  manager: "/manager",
  staff: "/staff",
  admin: "/admin",
};

function LoginShell({ children, homeHref }: { children: React.ReactNode; homeHref: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-background to-muted/40">
      <header className="flex h-14 items-center justify-between px-4">
        <BrandLogo href={homeHref} />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}

function BackToLanding({ href, label = "Back to NightLifeNext" }: { href: string; label?: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}><ArrowLeft className="size-4" /> {label}</Link>
    </Button>
  );
}

function useErrorToasts() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "suspended") toast.error("Account suspended.");
    if (err === "forbidden") toast.error("Access denied.");
  }, [searchParams]);
}

// ── Demo login ──────────────────────────────────────────────────────

function DemoLogin() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [personas, setPersonas] = useState<AuthUser[]>([]);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useErrorToasts();

  useEffect(() => {
    authService.listPersonas().then(setPersonas);
  }, []);

  async function signInAs(persona: AuthUser) {
    setSigningIn(persona.id);
    const user = await signIn({ email: persona.email, pin: "0000", role: persona.role });
    setSigningIn(null);
    if (!user) { toast.error("Sign-in failed."); return; }
    router.push(ROLE_HOME[user.role]);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !pin.trim()) { toast.error("Enter your email and PIN."); return; }
    setSubmitting(true);
    const user = await signIn({ email, pin, role: "manager" });
    setSubmitting(false);
    if (!user) { toast.error("No matching account."); return; }
    router.push(ROLE_HOME[user.role]);
  }

  return (
    <LoginShell homeHref="/demo">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </div>
            <h1 className="text-display text-lg">Welcome to the demo</h1>
            <p className="text-sm text-muted-foreground">
              Pick a role to explore NightLifeNext.
            </p>
          </div>

          <div className="space-y-2">
            {personas.map((p) => {
              const Icon = ROLE_ICON[p.role] ?? UserCog;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => signInAs(p)}
                  disabled={signingIn !== null}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card/50 p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent disabled:opacity-60"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {signingIn === p.id ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Icon className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Sign in as <span className="font-medium capitalize">{p.staffRole ?? p.role}</span>
                    </p>
                  </div>
                  <LogIn className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <details className="border-t pt-4">
            <summary
              className="cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.preventDefault(); setShowManual(!showManual); }}
            >
              {showManual ? "Hide manual sign-in" : "Manual sign-in with email + PIN"}
            </summary>
            {showManual && (
              <form onSubmit={handleManualSubmit} className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="username" placeholder="you@velvetmtl.club" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pin">PIN</Label>
                  <Input id="pin" type="password" inputMode="numeric" autoComplete="current-password" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            )}
          </details>

          <p className="text-center text-xs text-muted-foreground">
            Demo only — no real authentication.
          </p>
          <div className="text-center"><BackToLanding href="/demo" label="Back to demo" /></div>
        </CardContent>
      </Card>
    </LoginShell>
  );
}

// ── Live login ──────────────────────────────────────────────────────

function LiveLogin() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useErrorToasts();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    const user = await signIn({ email, pin: password, role: "manager" });
    setSubmitting(false);
    if (!user) { toast.error("Invalid email or password."); return; }
    router.push(ROLE_HOME[user.role]);
  }

  return (
    <LoginShell homeHref="/">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <LogIn className="size-5" />
            </div>
            <h1 className="text-display text-lg">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@venue.club"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="text-center"><BackToLanding href="/" /></div>
        </CardContent>
      </Card>
    </LoginShell>
  );
}

// ── Page ────────────────────────────────────────────────────────────

function LoginContent() {
  return isDemoMode() ? <DemoLogin /> : <LiveLogin />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
