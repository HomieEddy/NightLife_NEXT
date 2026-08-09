"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn, Sparkles, UserCog, Users, Shield, Beer, PersonStanding, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/auth-context";
import { authService } from "@/features/platform/auth-service";
import { isDemoMode } from "@/features/shared/app-mode";
import type { AuthUser, StaffRole } from "@/lib/types";

const STAFF_ROLE_ICON: Record<StaffRole, typeof UserCog> = {
  manager: UserCog,
  host: BadgeCheck,
  bartender: Beer,
  runner: PersonStanding,
  security: Shield,
  promoter: Users,
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
        <LocaleToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}

function BackToLanding({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}><ArrowLeft className="size-4" /> {label}</Link>
    </Button>
  );
}

function useErrorToasts(t: ReturnType<typeof useTranslations<"auth">>) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "suspended") toast.error(t("accountSuspended"));
    if (err === "forbidden") toast.error(t("accessDenied"));
  }, [searchParams, t]);
}

// ── Demo login ──────────────────────────────────────────────────────

function DemoLogin() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { signIn } = useAuth();
  const [personas, setPersonas] = useState<AuthUser[]>([]);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useErrorToasts(t);

  useEffect(() => {
    authService.listPersonas().then(setPersonas);
  }, []);

  async function signInAs(persona: AuthUser) {
    setSigningIn(persona.id);
    const user = await signIn({ email: persona.email, pin: "0000", role: persona.role });
    setSigningIn(null);
    if (!user) { toast.error(t("signInFailed")); return; }
    router.push(ROLE_HOME[user.role]);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !pin.trim()) { toast.error(t("enterEmailPin")); return; }
    setSubmitting(true);
    const user = await signIn({ email, pin, role: "manager" });
    setSubmitting(false);
    if (!user) { toast.error(t("noMatchingAccount")); return; }
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
            <h1 className="text-display text-xl">{t("demoWelcome")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("demoSubtitle")}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="pb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("venueTeam")}
            </p>
            {personas.map((p) => {
              const floorRole = p.staffRole ?? (p.role === "manager" ? "manager" : null);
              const Icon = floorRole ? (STAFF_ROLE_ICON[floorRole] ?? UserCog) : UserCog;
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
                      {t("signInAsRole", { role: floorRole ?? p.role })}
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
              {showManual ? t("hideManualSignIn") : t("manualSignIn")}
            </summary>
            {showManual && (
              <form onSubmit={handleManualSubmit} className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" type="email" autoComplete="username" placeholder="you@velvetmtl.club" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pin">{t("pin")}</Label>
                  <Input id="pin" type="password" inputMode="numeric" autoComplete="current-password" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? t("signingIn") : t("signIn")}
                </Button>
              </form>
            )}
          </details>

          <p className="text-center text-xs text-muted-foreground">
            {t("demoOnly")}
          </p>
          <div className="text-center"><BackToLanding href="/demo" label={t("backToDemo")} /></div>
        </CardContent>
      </Card>
    </LoginShell>
  );
}

// ── Live login ──────────────────────────────────────────────────────

function LiveLogin() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useErrorToasts(t);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(t("enterEmailPassword"));
      return;
    }
    setSubmitting(true);
    const user = await signIn({ email, pin: password, role: "manager" });
    setSubmitting(false);
    if (!user) { toast.error(t("invalidCredentials")); return; }
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
            <h1 className="text-display text-xl">{t("signIn")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("enterCredentials")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
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
              <Label htmlFor="password">{t("password")}</Label>
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
              {submitting ? t("signingIn") : t("signIn")}
            </Button>
          </form>
          <div className="text-center"><BackToLanding href="/" label={t("backToLanding")} /></div>
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
