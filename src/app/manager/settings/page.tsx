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
import { venueService } from "@/lib/services/venue-service";
import { computeFeeLines, computeServiceFee } from "@/lib/fees";
import { setManagerOnboarded } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import type { ServiceFee, Venue } from "@/lib/types";

export default function ManagerSettingsPage() {
  const router = useRouter();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    venueService.getVenue().then(setVenue);
  }, []);

  async function handleSave() {
    if (!venue) return;
    setSaving(true);
    try {
      const updated = await venueService.updateVenue(venue);
      setVenue(updated);
      toast.success("Venue settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save venue settings");
    } finally {
      setSaving(false);
    }
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
          <div className="space-y-1.5">
            <Label htmlFor="timezone">IANA timezone</Label>
            <Input
              id="timezone"
              value={venue.timezone}
              placeholder="America/Toronto"
              onChange={(e) => setVenue({ ...venue, timezone: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Used to group orders, reports and operational nights at the venue.
            </p>
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
          <CardTitle className="text-base">Live pulse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Order alert thresholds (minutes)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="order-warn" className="text-xs text-muted-foreground">
                  Warning
                </Label>
                <Input
                  id="order-warn"
                  type="number"
                  min={1}
                  value={venue.slaThresholds.orderWarnMinutes}
                  onChange={(e) =>
                    setVenue({
                      ...venue,
                      slaThresholds: {
                        ...venue.slaThresholds,
                        orderWarnMinutes: Math.max(1, Number(e.target.value)),
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="order-critical" className="text-xs text-muted-foreground">
                  Critical
                </Label>
                <Input
                  id="order-critical"
                  type="number"
                  min={1}
                  value={venue.slaThresholds.orderCriticalMinutes}
                  onChange={(e) =>
                    setVenue({
                      ...venue,
                      slaThresholds: {
                        ...venue.slaThresholds,
                        orderCriticalMinutes: Math.max(1, Number(e.target.value)),
                      },
                    })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              An order still pending or preparing past these ages shows up on the Dashboard&apos;s
              Pulse tab.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Help request alert thresholds (minutes)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="help-warn" className="text-xs text-muted-foreground">
                  Warning
                </Label>
                <Input
                  id="help-warn"
                  type="number"
                  min={1}
                  value={venue.slaThresholds.helpWarnMinutes}
                  onChange={(e) =>
                    setVenue({
                      ...venue,
                      slaThresholds: {
                        ...venue.slaThresholds,
                        helpWarnMinutes: Math.max(1, Number(e.target.value)),
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="help-critical" className="text-xs text-muted-foreground">
                  Critical
                </Label>
                <Input
                  id="help-critical"
                  type="number"
                  min={1}
                  value={venue.slaThresholds.helpCriticalMinutes}
                  onChange={(e) =>
                    setVenue({
                      ...venue,
                      slaThresholds: {
                        ...venue.slaThresholds,
                        helpCriticalMinutes: Math.max(1, Number(e.target.value)),
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Auto-flag open tables at last call</p>
              <p className="text-xs text-muted-foreground">
                Starting last call adds a closeout nudge to the Pulse feed for every occupied
                table.
              </p>
            </div>
            <Switch
              checked={venue.lastCallAutoFlagTables}
              onCheckedChange={(checked) => setVenue({ ...venue, lastCallAutoFlagTables: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="night-start">Night starts at</Label>
              <Input
                id="night-start"
                type="number"
                min={0}
                max={23}
                value={venue.nightStartHour}
                onChange={(e) => setVenue({ ...venue, nightStartHour: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="night-end">Night ends at</Label>
              <Input
                id="night-end"
                type="number"
                min={0}
                max={23}
                value={venue.nightEndHour}
                onChange={(e) => setVenue({ ...venue, nightEndHour: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Weekly opening hours</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={venue.openingHours.length === 7}
              onClick={() => {
                const day = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                  .find((candidate) => !venue.openingHours.some((slot) => slot.day === candidate));
                if (day) {
                  setVenue({
                    ...venue,
                    openingHours: [...venue.openingHours, { day, open: "20:00", close: "03:00" }],
                  });
                }
              }}
            >
              <Plus className="size-3.5" /> Add day
            </Button>
          </div>
          {venue.openingHours.map((slot, index) => (
            <div
              key={slot.day}
              className="grid grid-cols-[1fr_7rem_7rem_auto] items-end gap-2 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <Label htmlFor={`day-${index}`} className="text-xs">Day</Label>
                <select
                  id={`day-${index}`}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={slot.day}
                  onChange={(e) => setVenue({
                    ...venue,
                    openingHours: venue.openingHours.map((value, slotIndex) =>
                      slotIndex === index ? { ...value, day: e.target.value } : value,
                    ),
                  })}
                >
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <option key={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`open-${index}`} className="text-xs">Open</Label>
                <Input
                  id={`open-${index}`}
                  type="time"
                  value={slot.open}
                  onChange={(e) => setVenue({
                    ...venue,
                    openingHours: venue.openingHours.map((value, slotIndex) =>
                      slotIndex === index ? { ...value, open: e.target.value } : value,
                    ),
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`close-${index}`} className="text-xs">Close</Label>
                <Input
                  id={`close-${index}`}
                  type="time"
                  value={slot.close}
                  onChange={(e) => setVenue({
                    ...venue,
                    openingHours: venue.openingHours.map((value, slotIndex) =>
                      slotIndex === index ? { ...value, close: e.target.value } : value,
                    ),
                  })}
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${slot.day} hours`}
                onClick={() => setVenue({
                  ...venue,
                  openingHours: venue.openingHours.filter((_, slotIndex) => slotIndex !== index),
                })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
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
