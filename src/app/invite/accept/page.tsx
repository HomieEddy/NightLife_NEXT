"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { authClient } from "@/lib/auth-client";

function AcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("id");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invitationId) {
      toast.error("Missing invitation ID.");
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const invitation = await authClient.organization.getInvitation({ query: { id: invitationId } });
      if (invitation.error || !invitation.data) throw new Error("Invitation expired or already used.");

      const signup = await authClient.signUp.email({
        email: invitation.data.email,
        name: name.trim(),
        password,
      });
      if (signup.error) throw new Error(signup.error.message || "Could not create the account");

      const accepted = await authClient.organization.acceptInvitation({ invitationId });
      if (accepted.error) throw new Error(accepted.error.message || "Invitation expired or already used.");

      setDone(true);
      toast.success("Account created! Redirecting to staff…");
      setTimeout(() => router.push("/staff"), 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not accept the invitation");
    } finally {
      setSubmitting(false);
    }
  }

  if (!invitationId) {
    return (
      <div className="flex min-h-dvh flex-col bg-gradient-to-b from-background to-muted/40">
        <header className="flex h-14 items-center justify-between px-4">
          <BrandLogo />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Invalid invitation link. Ask your manager for a new one.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
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
            {done ? (
              <div className="space-y-2 text-center">
                <CheckCircle2 className="mx-auto size-10 text-green-500" />
                <h1 className="text-lg font-semibold">You&apos;re in!</h1>
                <p className="text-sm text-muted-foreground">
                  Redirecting to sign in…
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1 text-center">
                  <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <UserPlus className="size-5" />
                  </div>
                  <h1 className="text-lg font-semibold tracking-tight">
                    Join the team
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Set up your account to accept the invitation.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-name">Full name</Label>
                    <Input
                      id="invite-name"
                      placeholder="e.g. Marie Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-password">Password</Label>
                    <Input
                      id="invite-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-confirm">Confirm password</Label>
                    <Input
                      id="invite-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Same password again"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {submitting ? "Creating account…" : "Accept invitation"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptContent />
    </Suspense>
  );
}
