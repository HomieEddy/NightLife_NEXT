"use client";

// Plan 10 graduates this demo-only surface.

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDemoMode } from "@/features/shared/app-mode";
import { adminService } from "@/lib/services/admin-service";

export default function LeadPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const venueName = String(data.get("venueName") ?? "").trim();
    const contactName = String(data.get("contactName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    if (!venueName || !contactName || !email) {
      setError("Please fill in the required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        venueName,
        contactName,
        email,
        phone: String(data.get("phone") ?? ""),
        city: String(data.get("city") ?? ""),
        source: "landing-page" as const,
        dealValue: 2988,
        notes: String(data.get("notes") ?? ""),
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
    } finally {
      setSubmitting(false);
    }
  }

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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="venueName">Venue name *</Label>
                <Input id="venueName" name="venueName" placeholder="Club Onyx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Paris" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contactName">Your name *</Label>
                <Input id="contactName" name="contactName" placeholder="Alex Martin" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" placeholder="+33 6 …" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email *</Label>
              <Input id="email" name="email" type="email" placeholder="alex@clubonyx.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Anything we should know?</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Capacity, number of zones, current ordering setup…"
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" variant="foil" className="w-full" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Sending…" : "Request demo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
