"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationPreferencesCard } from "@/components/shared/notification-preferences-card";
import { venueService } from "@/features/venue/services";
import { ordersService } from "@/features/ordering/services";
import { venueKeys } from "@/features/venue/query-keys";
import { ordersKeys } from "@/features/ordering/query-keys";
import { useAuth } from "@/context/auth-context";
import { computeFeeLines, computeServiceFee } from "@/features/ordering/fees";
import { setManagerOnboarded } from "@/lib/onboarding";
import { cn } from "@/features/shared/utils";
import type { AdjustmentReason, ServiceFee, TabAdjustmentKind, Venue } from "@/lib/types";

export default function ManagerSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Venue | null>(null);

  const { data: venue } = useQuery({
    queryKey: venueKeys.single(venueId),
    queryFn: () => venueService.getVenue(),
    enabled: !!venueId,
  });

  useEffect(() => {
    if (venue && !draft) setDraft(venue);
  }, [venue, draft]);

  const saveMutation = useMutation({
    mutationFn: (v: Venue) => venueService.updateVenue(v),
    onSuccess: (updated) => {
      setDraft(updated);
      queryClient.invalidateQueries({ queryKey: venueKeys.single(venueId) });
      toast.success("Venue settings saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save venue settings");
    },
  });

  const saving = saveMutation.isPending;

  function handleSave() {
    if (!draft) return;
    saveMutation.mutate(draft);
  }

  if (draft === null) {
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

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="service">Service &amp; Fees</TabsTrigger>
          <TabsTrigger value="safety">Safety &amp; Pulse</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
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
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">IANA timezone</Label>
                <Input
                  id="timezone"
                  value={draft.timezone}
                  placeholder="America/Toronto"
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Used to group orders, reports and operational nights at the venue.
                </p>
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
                    value={draft.nightStartHour}
                    onChange={(e) => setDraft({ ...draft, nightStartHour: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="night-end">Night ends at</Label>
                  <Input
                    id="night-end"
                    type="number"
                    min={0}
                    max={23}
                    value={draft.nightEndHour}
                    onChange={(e) => setDraft({ ...draft, nightEndHour: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Weekly opening hours</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={draft.openingHours.length === 7}
                  onClick={() => {
                    const day = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                      .find((candidate) => !draft.openingHours.some((slot) => slot.day === candidate));
                    if (day) {
                      setDraft({
                        ...draft,
                        openingHours: [...draft.openingHours, { day, open: "20:00", close: "03:00" }],
                      });
                    }
                  }}
                >
                  <Plus className="size-3.5" /> Add day
                </Button>
              </div>
              {draft.openingHours.map((slot, index) => (
                <div
                  key={slot.day}
                  className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
                >
                  <div className="col-span-1 space-y-1 sm:col-span-1">
                    <Label htmlFor={`day-${index}`} className="text-xs">Day</Label>
                    <select
                      id={`day-${index}`}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={slot.day}
                      onChange={(e) => setDraft({
                        ...draft,
                        openingHours: draft.openingHours.map((value, slotIndex) =>
                          slotIndex === index ? { ...value, day: e.target.value } : value,
                        ),
                      })}
                    >
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                        <option key={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div className="row-start-1 self-center justify-self-end sm:col-start-4 sm:row-start-auto sm:self-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${slot.day} hours`}
                      onClick={() => setDraft({
                        ...draft,
                        openingHours: draft.openingHours.filter((_, slotIndex) => slotIndex !== index),
                      })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`open-${index}`} className="text-xs">Open</Label>
                    <Input
                      id={`open-${index}`}
                      type="time"
                      value={slot.open}
                      onChange={(e) => setDraft({
                        ...draft,
                        openingHours: draft.openingHours.map((value, slotIndex) =>
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
                      onChange={(e) => setDraft({
                        ...draft,
                        openingHours: draft.openingHours.map((value, slotIndex) =>
                          slotIndex === index ? { ...value, close: e.target.value } : value,
                        ),
                      })}
                    />
                  </div>
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
        </TabsContent>

        <TabsContent value="service" className="space-y-6">
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
                      setDraft({
                        ...draft,
                        serviceFees: [
                          ...draft.serviceFees,
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

              {draft.serviceFees.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No fees configured — guests pay the subtotal plus tip only.
                </p>
              ) : (
                <div className="space-y-2">
                  {draft.serviceFees.map((fee) => {
                    const patchFee = (patch: Partial<ServiceFee>) =>
                      setDraft({
                        ...draft,
                        serviceFees: draft.serviceFees.map((f) =>
                          f.id === fee.id ? { ...f, ...patch } : f,
                        ),
                      });
                    return (
                      <div key={fee.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                        <Input
                          placeholder="Name (e.g. TVQ)"
                          value={fee.name}
                          onChange={(e) => patchFee({ name: e.target.value })}
                          className="min-w-0 flex-1 basis-28"
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
                            setDraft({
                              ...draft,
                              serviceFees: draft.serviceFees.filter((f) => f.id !== fee.id),
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

              <div className="space-y-1.5">
                <Label>Tip presets</Label>
                <p className="text-xs text-muted-foreground">
                  Percentage options shown to guests at checkout. The first preset is
                  the default.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.tipPresets.map((pct, index) => (
                    <div key={index} className="flex items-center gap-1 rounded-lg border px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={pct}
                        onChange={(e) => {
                          const next = [...draft.tipPresets];
                          next[index] = Math.max(0, Math.min(100, Number(e.target.value)));
                          setDraft({ ...draft, tipPresets: next, defaultTipPct: next[0] ?? 0 });
                        }}
                        className="w-16 pr-5 tabular-nums"
                        aria-label={`Tip preset ${index + 1}`}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                        aria-label={`Remove ${pct}% preset`}
                        onClick={() => {
                          const next = draft.tipPresets.filter((_, i) => i !== index);
                          setDraft({ ...draft, tipPresets: next, defaultTipPct: next[0] ?? 0 });
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = [...draft.tipPresets, 0];
                      setDraft({ ...draft, tipPresets: next });
                    }}
                  >
                    <Plus className="size-3.5" /> Add preset
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={draft.currency} disabled />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Example on a $200 order:{" "}
                {computeFeeLines(200, draft).map((line, i) => (
                  <span key={line.fee.id}>
                    {i > 0 && " + "}
                    {line.fee.name || "Fee"}{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      ${line.amount.toFixed(2)}
                    </span>
                  </span>
                ))}
                {draft.serviceFees.length > 0 && (
                  <>
                    {" = "}
                    <span className="font-semibold text-foreground tabular-nums">
                      ${computeServiceFee(200, draft).toFixed(2)}
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
                  checked={draft.autoApproveGuests}
                  onCheckedChange={(checked) => setDraft({ ...draft, autoApproveGuests: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <TabLedgerCard draft={draft} setDraft={setDraft} venueId={venueId} />
        </TabsContent>

        <TabsContent value="safety" className="space-y-6">
          <DoorSafetyCard draft={draft} setDraft={setDraft} />

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
                      value={draft.slaThresholds.orderWarnMinutes}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          slaThresholds: {
                            ...draft.slaThresholds,
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
                      value={draft.slaThresholds.orderCriticalMinutes}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          slaThresholds: {
                            ...draft.slaThresholds,
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
                      value={draft.slaThresholds.helpWarnMinutes}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          slaThresholds: {
                            ...draft.slaThresholds,
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
                      value={draft.slaThresholds.helpCriticalMinutes}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          slaThresholds: {
                            ...draft.slaThresholds,
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
                  checked={draft.lastCallAutoFlagTables}
                  onCheckedChange={(checked) => setDraft({ ...draft, lastCallAutoFlagTables: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationPreferencesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Tab ledger: comp threshold, warning ratio, reason codes ----------

const KIND_LABEL: Record<TabAdjustmentKind, string> = { void: "Void", comp: "Comp", discount: "Discount" };

function TabLedgerCard({
  draft,
  setDraft,
  venueId,
}: {
  draft: Venue;
  setDraft: (venue: Venue) => void;
  venueId: string;
}) {
  const queryClient = useQueryClient();
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<TabAdjustmentKind>("comp");

  const { data: reasons } = useQuery({
    queryKey: ordersKeys.adjustmentReasons(venueId),
    queryFn: () => ordersService.listAllAdjustmentReasons(),
    enabled: !!venueId,
  });

  const addReasonMutation = useMutation({
    mutationFn: async () => {
      return ordersService.createAdjustmentReason({
        kind: newKind,
        code: newCode.trim(),
        label: newLabel.trim(),
        isActive: true,
      });
    },
    onSuccess: (reason) => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.adjustmentReasons(venueId) });
      setNewCode("");
      setNewLabel("");
      toast.success(`Added "${reason.label}"`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not add the reason");
    },
  });

  const toggleReasonMutation = useMutation({
    mutationFn: ({ reasonId, isActive }: { reasonId: string; isActive: boolean }) =>
      ordersService.setAdjustmentReasonActive(reasonId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.adjustmentReasons(venueId) });
    },
  });

  function addReason() {
    if (!newCode.trim() || !newLabel.trim()) {
      toast.error("Give the reason a code and a label");
      return;
    }
    addReasonMutation.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tab ledger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="comp-threshold">Comp threshold ($)</Label>
            <Input
              id="comp-threshold"
              type="number"
              min={0}
              step="1"
              value={draft.compThresholdCents / 100}
              onChange={(e) =>
                setDraft({ ...draft, compThresholdCents: Math.round(Number(e.target.value || 0) * 100) })
              }
            />
            <p className="text-xs text-muted-foreground">Comps above this escalate to manager approval.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min-spend-ratio">Minimum-spend warning ratio</Label>
            <Input
              id="min-spend-ratio"
              type="number"
              min={0}
              max={1}
              step="0.05"
              value={draft.minimumSpendWarningRatio}
              onChange={(e) => setDraft({ ...draft, minimumSpendWarningRatio: Number(e.target.value || 0) })}
            />
            <p className="text-xs text-muted-foreground">Shortfall/minimum ratio that turns the progress ring amber.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Reason codes</Label>
          {reasons === undefined ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : (
            <div className="space-y-1.5">
              {reasons.map((reason) => (
                <div key={reason.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{reason.label}</p>
                    <p className="text-xs capitalize text-muted-foreground">{reason.kind} · {reason.code}</p>
                  </div>
                  <Switch
                    checked={reason.isActive}
                    onCheckedChange={(checked) => toggleReasonMutation.mutate({ reasonId: reason.id, isActive: checked })}
                    aria-label={`${reason.label} active`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[7rem_1fr_1fr_auto] items-end gap-2 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="new-reason-kind" className="text-xs">Kind</Label>
              <select
                id="new-reason-kind"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as TabAdjustmentKind)}
              >
                {(["void", "comp", "discount"] as const).map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-reason-code" className="text-xs">Code</Label>
              <Input id="new-reason-code" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="staff-error" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-reason-label" className="text-xs">Label</Label>
              <Input id="new-reason-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Staff error" />
            </div>
            <Button type="button" size="sm" onClick={addReason} disabled={addReasonMutation.isPending}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Door & Safety (S-01, S-03, S-13) ----------

function DoorSafetyCard({
  draft,
  setDraft,
}: {
  draft: Venue;
  setDraft: (venue: Venue) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Door & Safety</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="legal-capacity">Legal capacity</Label>
            <Input
              id="legal-capacity"
              type="number"
              min={1}
              value={draft.legalCapacity}
              onChange={(e) => setDraft({ ...draft, legalCapacity: Math.max(1, Number(e.target.value) || 400) })}
            />
            <p className="text-xs text-muted-foreground">Fire-code maximum — the door counts against this.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="occupancy-warn">Occupancy warning ratio</Label>
            <Input
              id="occupancy-warn"
              type="number"
              min={0}
              max={1}
              step="0.05"
              value={draft.occupancyWarnRatio}
              onChange={(e) => setDraft({ ...draft, occupancyWarnRatio: Number(e.target.value || 0) })}
            />
            <p className="text-xs text-muted-foreground">Ratio at which Pulse raises a capacity warning.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="legal-drinking-age">Legal drinking age</Label>
            <Input
              id="legal-drinking-age"
              type="number"
              min={16}
              max={21}
              value={draft.legalDrinkingAge}
              onChange={(e) => setDraft({ ...draft, legalDrinkingAge: Number(e.target.value || 18) })}
            />
            <p className="text-xs text-muted-foreground">Jurisdiction minimum — underage admission is blocked at the door.</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Require ID check at door</p>
            <p className="text-xs text-muted-foreground">
              Forces the ID-check toggle on at admission time. Records the check only — never a document scan.
            </p>
          </div>
          <Switch
            checked={draft.doorRequiresIdCheck}
            onCheckedChange={(checked) => setDraft({ ...draft, doorRequiresIdCheck: checked })}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Coat check</p>
            <p className="text-xs text-muted-foreground">
              Enables the entire coat-check surface. Disable if your venue doesn&apos;t run one.
            </p>
          </div>
          <Switch
            checked={draft.coatCheckEnabled}
            onCheckedChange={(checked) => setDraft({ ...draft, coatCheckEnabled: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
