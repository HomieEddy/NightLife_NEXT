"use client";

// Plan 10 graduates this demo-only surface.

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDemoMode } from "@/features/shared/app-mode";
import { LIVE_APP_URL } from "@/features/shared/app-origins";
import { adminService } from "@/features/platform/admin-service";
import { zLeadInput } from "@/lib/form-schemas";

export default function LeadPage() {
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(zLeadInput),
    defaultValues: { venueName: "", contactName: "", email: "", phone: "", city: "", source: "landing-page" as const, dealValue: 2988, notes: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    if (!consent) {
      setError("You must agree to the privacy policy to submit.");
      return;
    }
    try {
      const payload = {
        venueName: data.venueName.trim(),
        contactName: data.contactName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() ?? "",
        city: data.city?.trim() ?? "",
        source: "landing-page" as const,
        dealValue: 2988,
        notes: data.notes?.trim() ?? "",
        // Consent evidence — the checkbox above is the opt-in (Law 25).
        consentAt: new Date().toISOString(),
      };
      if (isDemoMode()) {
        await adminService.createLead(payload);
      } else {
        const res = await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Request failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  });

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-display mt-5 text-2xl">You&apos;re on the list</h1>
        <p className="mt-2 text-muted-foreground">
          Our team will reach out within one business day to schedule your walkthrough. It just
          landed in the <Link href="/admin/leads" className="text-primary underline">admin lead pipeline</Link>.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <div className="text-center">
        <h1 className="text-display text-3xl">Request a demo</h1>
        <p className="text-voice mt-2 text-lg text-muted-foreground">
          Tell us about your venue — we&apos;ll tailor the walkthrough to your floor plan.
        </p>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Venue details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="venueName">Venue name *</Label>
                <Input id="venueName" {...register("venueName")} placeholder="Club Onyx" />
                {errors.venueName && <p className="text-xs text-red-600">{errors.venueName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register("city")} placeholder="Paris" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contactName">Your name *</Label>
                <Input id="contactName" {...register("contactName")} placeholder="Alex Martin" />
                {errors.contactName && <p className="text-xs text-red-600">{errors.contactName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} type="tel" placeholder="+33 6 …" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email *</Label>
              <Input id="email" {...register("email")} type="email" placeholder="alex@clubonyx.com" />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Anything we should know?</Label>
              <Textarea id="notes" {...register("notes")} placeholder="Capacity, number of zones, current ordering setup…" rows={3} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your contact information will only be used to reach you about your demo request and to create your account if you sign up.
              </p>
              <div className="flex items-start gap-2">
                <input
                  id="lead-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 size-4 accent-primary"
                />
                <Label htmlFor="lead-consent" className="text-xs font-normal leading-relaxed">
                  I have read and agree to the{" "}
                  <Link
                    href={isDemoMode() ? `${LIVE_APP_URL}/privacy` : "/privacy"}
                    target="_blank"
                    className="text-primary underline"
                  >
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" variant="foil" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Sending…" : "Request demo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
