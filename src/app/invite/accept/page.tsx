"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { authClient } from "@/lib/auth-client";
import { z } from "zod";

function AcceptContent() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("id");
  const [done, setDone] = useState(false);

  const zAcceptInvite = useMemo(() => z.object({
    name: z.string().min(1, t("fullName")),
    password: z.string().min(8, t("password")),
    confirm: z.string().min(1, t("confirmPassword")),
    consent: z.literal(true, { message: t("consentRequired") }),
  }).refine((d) => d.password === d.confirm, { message: t("passwordsDontMatch"), path: ["confirm"] }), [t]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(zAcceptInvite),
    defaultValues: { name: "", password: "", confirm: "", consent: false as unknown as true },
  });

  const onSubmit = handleSubmit(async (data) => {
    if (!invitationId) {
      toast.error(t("missingInvite"));
      return;
    }
    try {
      const invitation = await authClient.organization.getInvitation({ query: { id: invitationId } });
      if (invitation.error || !invitation.data) throw new Error(t("inviteExpired"));

      const signup = await authClient.signUp.email({
        email: invitation.data.email,
        name: data.name.trim(),
        password: data.password,
      });
      if (signup.error) throw new Error(signup.error.message || t("couldNotCreate"));

      const accepted = await authClient.organization.acceptInvitation({ invitationId });
      if (accepted.error) throw new Error(accepted.error.message || t("inviteExpired"));

      setDone(true);
      toast.success(t("accountCreated"));
      setTimeout(() => router.push("/staff"), 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("couldNotAccept"));
    }
  });

  if (!invitationId) {
    return (
      <div className="flex min-h-dvh flex-col bg-gradient-to-b from-background to-muted/40">
        <header className="flex h-14 items-center justify-between px-4">
          <BrandLogo />
          <ThemeToggle />
          <LocaleToggle />
        </header>
        <main className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t("invalidInvite")}
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
        <LocaleToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-5 p-6">
            {done ? (
              <div className="space-y-2 text-center">
                <CheckCircle2 className="mx-auto size-10 text-green-500" />
                <h1 className="text-display text-xl">{t("youreIn")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("redirecting")}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1 text-center">
                  <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <UserPlus className="size-5" />
                  </div>
                  <h1 className="text-display text-xl">{t("joinTheTeam")}</h1>
                  <p className="text-sm text-muted-foreground">
                    {t("setupAccount")}
                  </p>
                </div>
                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-name">{t("fullName")}</Label>
                    <Input id="invite-name" placeholder="e.g. Marie Dupont" {...register("name")} />
                    {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-password">{t("password")}</Label>
                    <Input id="invite-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...register("password")} />
                    {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-confirm">{t("confirmPassword")}</Label>
                    <Input id="invite-confirm" type="password" autoComplete="new-password" placeholder="Same password again" {...register("confirm")} />
                    {errors.confirm && <p className="text-xs text-red-600">{errors.confirm.message}</p>}
                  </div>
                  <div className="flex items-start gap-2">
                    <input
                      id="invite-consent"
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      {...register("consent")}
                    />
                    <Label htmlFor="invite-consent" className="text-sm font-normal leading-relaxed">
                      {t("consentText")}{" "}
                      <Link href="/privacy" target="_blank" className="text-primary underline">Privacy Policy</Link>
                    </Label>
                  </div>
                  {errors.consent && <p className="text-xs text-red-600">{errors.consent.message}</p>}
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    {isSubmitting ? t("creatingAccount") : t("acceptInvite")}
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
