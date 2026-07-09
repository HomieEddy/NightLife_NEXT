"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { mockVenueService } from "@/lib/mock-services/venue-service";
import { computeFeeLines, computeServiceFee } from "@/lib/fees";
import { setManagerOnboarded } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import type { ServiceFee, Venue } from "@/lib/types";

export default function ManagerSettingsPage() {
  const router = useRouter();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mockVenueService.getVenue().then(setVenue);
  }, []);

  async function handleSave() {
    if (!venue) return;
    setSaving(true);
    // TODO(backend): PATCH /api/venue — persist settings per tenant.
    await mockVenueService.updateVenue(venue);
    setSaving(false);
    toast.success("Venue settings saved");
  }

  if (venue === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Venue settings" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Venue settings"
        description="Identity, service rules and guest-flow behavior."
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Venue name</Label>
              <Input
                id="name"
                value={venue.name}
                onChange={(e) => setVenue({ ...venue, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={venue.city}
                onChange={(e) => setVenue({ ...venue, city: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={venue.address}
              onChange={(e) => setVenue({ ...venue, address: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Fees & taxes</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setVenue({
                    ...venue,
                    serviceFees: [
                      ...venue.serviceFees,
                      { id: `fee-${Date.now()}`, name: "", type: "percentage", value: 0 },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" /> Add fee
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Every fee is applied to each guest order — mix taxes, service charges and flat fees.
            </p>
          </div>

          {venue.serviceFees.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No fees configured — guests pay the subtotal plus tip only.
            </p>
          ) : (
            <div className="space-y-2">
              {venue.serviceFees.map((fee) => {
                const patchFee = (patch: Partial<ServiceFee>) =>
                  setVenue({
                    ...venue,
                    serviceFees: venue.serviceFees.map((f) =>
                      f.id === fee.id ? { ...f, ...patch } : f,
                    ),
                  });
                return (
                  <div key={fee.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                    <Input
                      placeholder="Name (e.g. TVQ)"
                      value={fee.name}
                      onChange={(e) => patchFee({ name: e.target.value })}
                      className="w-36 flex-1"
                      aria-label="Fee name"
                    />
                    <div className="flex gap-1">
                      {(["percentage", "flat"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => patchFee({ type })}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            fee.type === type
                              ? "border-primary bg-primary/15 text-primary"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {type === "percentage" ? "%" : "$ flat"}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step={fee.type === "percentage" ? 0.001 : 1}
                        value={fee.value}
                        onChange={(e) =>
                          patchFee({ value: Math.max(0, Number(e.target.value)) })
                        }
                        className="w-24 pr-7 tabular-nums"
                        aria-label="Fee value"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {fee.type === "percentage" ? "%" : "$"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Remove ${fee.name || "fee"}`}
                      onClick={() =>
                        setVenue({
                          ...venue,
                          serviceFees: venue.serviceFees.filter((f) => f.id !== fee.id),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={venue.currency} disabled />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Example on a $200 order:{" "}
            {computeFeeLines(200, venue).map((line, i) => (
              <span key={line.fee.id}>
                {i > 0 && " + "}
                {line.fee.name || "Fee"}{" "}
                <span className="font-medium text-foreground tabular-nums">
                  ${line.amount.toFixed(2)}
                </span>
              </span>
            ))}
            {venue.serviceFees.length > 0 && (
              <>
                {" = "}
                <span className="font-semibold text-foreground tabular-nums">
                  ${computeServiceFee(200, venue).toFixed(2)}
                </span>{" "}
                in fees.
              </>
            )}
          </p>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Auto-approve guests</p>
              <p className="text-xs text-muted-foreground">
                Skip host approval — guests can order the moment they scan.
              </p>
            </div>
            <Switch
              checked={venue.autoApproveGuests}
              onCheckedChange={(checked) => setVenue({ ...venue, autoApproveGuests: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opening hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {venue.openingHours.map((slot) => (
            <div
              key={slot.day}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <span className="font-medium">{slot.day}</span>
              <span className="tabular-nums text-muted-foreground">
                {slot.open} – {slot.close}
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Editing hours is out of scope for the prototype.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Guided onboarding</p>
            <p className="text-xs text-muted-foreground">
              Re-run the first-time setup wizard — your current settings are prefilled.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setManagerOnboarded(false);
              router.push("/manager/onboarding");
            }}
          >
            <RotateCcw className="size-3.5" /> Restart onboarding
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
