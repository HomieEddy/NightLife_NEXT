"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { mockAuthService } from "@/lib/mock-services/auth-service";
import { cn } from "@/lib/utils";
import type { AuthRole, AuthUser } from "@/lib/types";

const ROLE_HOME: Record<AuthRole, string> = {
  manager: "/manager",
  staff: "/staff",
  admin: "/admin",
};

const ROLES: { value: AuthRole; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
];

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [role, setRole] = useState<AuthRole>("manager");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [personas, setPersonas] = useState<AuthUser[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mockAuthService.listPersonas().then(setPersonas);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !pin.trim()) {
      toast.error("Enter your email and PIN.");
      return;
    }
    setSubmitting(true);
    const ok = await signIn({ email, pin, role });
    setSubmitting(false);
    if (!ok) {
      toast.error("No matching account for that email and role.");
      return;
    }
    router.push(ROLE_HOME[role]);
  }

  function usePersona(p: AuthUser) {
    setRole(p.role);
    setEmail(p.email);
    setPin("0000");
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
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight">Staff sign in</h1>
              <p className="text-sm text-muted-foreground">
                Demo only — pick a role and use any PIN.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                    role === r.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@luxenoir.club"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : (<><LogIn className="size-4" /> Sign in</>)}
              </Button>
            </form>

            {personas.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-center text-xs text-muted-foreground">Or sign in as a demo persona</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {personas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => usePersona(p)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        role === p.role && email === p.email
                          ? "border-primary bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
