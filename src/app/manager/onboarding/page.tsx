"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Building2, Check, Loader2, Map, Martini, PartyPopper, Plus, Trash2, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { mockMenuService } from "@/lib/mock-services/menu-service";
import { mockStaffService } from "@/lib/mock-services/staff-service";
import { mockVenueService } from "@/lib/mock-services/venue-service";
import { setManagerOnboarded } from "@/lib/onboarding";
import { ZONE_SWATCH } from "@/lib/zone-colors";
import { cn } from "@/lib/utils";
import type { MenuCategory, ServiceFee, StaffMember, Venue, VenueTable, Zone } from "@/lib/types";

const STEPS = [
  { id: "venue", label: "Venue", icon: Building2 },
  { id: "floor", label: "Floor", icon: Map },
  { id: "menu", label: "Menu & fees", icon: Martini },
  { id: "profile", label: "You & launch", icon: UserRound },
] as const;

const TIMEZONES = ["Europe/Paris", "Europe/London", "Europe/Berlin", "America/Montreal", "America/New_York"];

interface ZoneDraft {
  id: string;
  name: string;
  color: string;
  tableCount: number; // informational — tables are managed on their own page
}

export default function ManagerOnboardingPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  // Step 1 — venue (prefilled)
  const [venue, setVenue] = useState<Venue | null>(null);

  // Step 2 — floor (prefilled)
  const [zones, setZones] = useState<ZoneDraft[]>([]);

  // Step 3 — menu & fees (prefilled)
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [fees, setFees] = useState<ServiceFee[]>([]);

  // Step 4 — manager profile (prefilled)
  const [me, setMe] = useState<Pick<StaffMember, "name" | "email"> | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      mockVenueService.getVenue(),
      mockVenueService.listZones(),
      mockVenueService.listTables(),
      mockMenuService.listCategories(true),
      mockStaffService.listStaff(),
    ]).then(([venueData, zoneList, tables, catList, staff]) => {
      setVenue(venueData);
      setFees(venueData.serviceFees);
      setZones(
        zoneList.map((zone: Zone) => ({
          id: zone.id,
          name: zone.name,
          color: zone.color,
          tableCount: tables.filter((t: VenueTable) => t.zoneId === zone.id).length,
        })),
      );
      setCategories(catList);
      const manager = staff.find((s) => s.role === "manager");
      if (manager) {
        setMe({ name: manager.name, email: manager.email });
        setManagerId(manager.id);
      }
      setLoaded(true);
    });
  }, []);

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return !!venue && venue.name.trim().length > 0 && venue.city.trim().length > 0;
      case 1:
        return zones.length > 0 && zones.every((z) => z.name.trim());
      case 2:
        return categories.some((c) => c.isActive);
      case 3:
        return !!me && me.name.trim().length > 0 && /\S+@\S+\.\S+/.test(me.email);
      default:
        return false;
    }
  }, [step, venue, zones, categories, me]);

  function patchZone(id: string, patch: Partial<ZoneDraft>) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function toggleCategory(id: string) {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c)),
    );
  }

  async function launch() {
    if (!venue || !me) return;
    setLaunching(true);
    // Apply every edit back to the live venue config.
    await mockVenueService.updateVenue({
      name: venue.name.trim(),
      city: venue.city.trim(),
      address: venue.address.trim(),
      timezone: venue.timezone,
      serviceFees: fees.filter((f) => f.name.trim() && f.value > 0),
      autoApproveGuests: venue.autoApproveGuests,
    });
    for (const zone of zones) {
      await mockVenueService.updateZone(zone.id, { name: zone.name.trim(), color: zone.color });
    }
    const liveCategories = await mockMenuService.listCategories(true);
    for (const cat of categories) {
      const live = liveCategories.find((c) => c.id === cat.id);
      if (live && live.isActive !== cat.isActive) await mockMenuService.toggleCategory(cat.id);
    }
    if (managerId) {
      await mockStaffService.updateStaff(managerId, {
        name: me.name.trim(),
        email: me.email.trim().toLowerCase(),
      });
    }
    setManagerOnboarded(true);
    setLaunching(false);
    toast.success(`${venue.name} is set up — welcome to your dashboard!`, {
      icon: <PartyPopper className="size-4" />,
    });
    router.replace("/manager");
  }

  function skip() {
    setManagerOnboarded(true);
    router.replace("/manager");
  }

  if (!loaded || !venue) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Welcome to NightLifeNext" description="Loading your venue…" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Welcome, let's set up ${venue.name}`}
        description="Everything is prefilled from your signup — review, tweak and launch."
        actions={
          <Button variant="ghost" size="sm" onClick={skip}>
            Skip for now
          </Button>
        }
      />

      {/* ---------- Stepper ---------- */}
      <ol className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                i === step && "border-primary bg-primary/10 text-primary",
                i < step && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
                i > step && "text-muted-foreground/60",
              )}
            >
              {i < step ? <Check className="size-4" /> : <s.icon className="size-4" />}
              <span className="text-[11px] font-medium">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-5 p-5">
          {/* ---------- Step 1: venue ---------- */}
          {step === 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mb-name">Venue name *</Label>
                  <Input
                    id="mb-name"
                    value={venue.name}
                    onChange={(e) => setVenue({ ...venue, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mb-city">City *</Label>
                  <Input
                    id="mb-city"
                    value={venue.city}
                    onChange={(e) => setVenue({ ...venue, city: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mb-address">Address</Label>
                <Input
                  id="mb-address"
                  value={venue.address}
                  onChange={(e) => setVenue({ ...venue, address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select
                    value={venue.timezone}
                    onValueChange={(timezone) => setVenue({ ...venue, timezone })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={venue.currency} disabled />
                  <p className="text-xs text-muted-foreground">Set by your subscription contract.</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Auto-approve guests</p>
                  <p className="text-xs text-muted-foreground">
                    Skip host approval — guests order the moment they scan.
                  </p>
                </div>
                <Switch
                  checked={venue.autoApproveGuests}
                  onCheckedChange={(autoApproveGuests) => setVenue({ ...venue, autoApproveGuests })}
                />
              </div>
            </>
          )}

          {/* ---------- Step 2: floor ---------- */}
          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                Your zones, seeded from signup. Rename or recolor them — tables and the floor map
                are fine-tuned later on their own pages.
              </p>
              <div className="space-y-2">
                {zones.map((zone) => (
                  <div key={zone.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                    <Input
                      value={zone.name}
                      onChange={(e) => patchZone(zone.id, { name: e.target.value })}
                      className="w-40 flex-1"
                      aria-label="Zone name"
                    />
                    <div className="flex gap-1">
                      {Object.keys(ZONE_SWATCH).map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={color}
                          onClick={() => patchZone(zone.id, { color })}
                          className={cn(
                            "size-6 rounded-full border-2 transition-transform",
                            ZONE_SWATCH[color],
                            zone.color === color
                              ? "border-foreground scale-110"
                              : "border-transparent opacity-50 hover:opacity-100",
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {zone.tableCount} tables
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ---------- Step 3: menu & fees ---------- */}
          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label>Active menu categories</Label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        cat.isActive
                          ? "border-primary bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Hidden categories keep their bottles but disappear from the guest menu.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Fees & taxes</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFees([
                        ...fees,
                        { id: `fee-${Date.now()}`, name: "", type: "percentage", value: 0 },
                      ])
                    }
                  >
                    <Plus className="size-3.5" /> Add fee
                  </Button>
                </div>
                <div className="space-y-2">
                  {fees.map((fee) => (
                    <div key={fee.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                      <Input
                        placeholder="Name (e.g. TVQ)"
                        value={fee.name}
                        onChange={(e) =>
                          setFees(fees.map((f) => (f.id === fee.id ? { ...f, name: e.target.value } : f)))
                        }
                        className="w-32 flex-1"
                      />
                      <div className="flex gap-1">
                        {(["percentage", "flat"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              setFees(fees.map((f) => (f.id === fee.id ? { ...f, type } : f)))
                            }
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
                      <Input
                        type="number"
                        min={0}
                        step={fee.type === "percentage" ? 0.001 : 1}
                        value={fee.value}
                        onChange={(e) =>
                          setFees(
                            fees.map((f) =>
                              f.id === fee.id ? { ...f, value: Math.max(0, Number(e.target.value)) } : f,
                            ),
                          )
                        }
                        className="w-24 tabular-nums"
                        aria-label="Fee value"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove fee"
                        className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                        onClick={() => setFees(fees.filter((f) => f.id !== fee.id))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ---------- Step 4: profile + review ---------- */}
          {step === 3 && me && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mb-mgr-name">Your name *</Label>
                  <Input
                    id="mb-mgr-name"
                    value={me.name}
                    onChange={(e) => setMe({ ...me, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mb-mgr-email">Your email *</Label>
                  <Input
                    id="mb-mgr-email"
                    type="email"
                    value={me.email}
                    onChange={(e) => setMe({ ...me, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border p-4 text-sm">
                <p className="font-medium">Review</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <p className="text-muted-foreground">Venue</p>
                  <p>{venue.name} · {venue.city}</p>
                  <p className="text-muted-foreground">Locale</p>
                  <p>{venue.timezone} · {venue.currency}</p>
                  <p className="text-muted-foreground">Floor</p>
                  <p>
                    {zones.length} zones · {zones.reduce((s, z) => s + z.tableCount, 0)} tables
                  </p>
                  <p className="text-muted-foreground">Menu</p>
                  <p>{categories.filter((c) => c.isActive).map((c) => c.name).join(", ")}</p>
                  <p className="text-muted-foreground">Fees</p>
                  <p>
                    {fees.filter((f) => f.name.trim()).length === 0
                      ? "None"
                      : fees
                          .filter((f) => f.name.trim())
                          .map((f) => `${f.name} ${f.type === "flat" ? `$${f.value}` : `${f.value}%`}`)
                          .join(" + ")}
                  </p>
                  <p className="text-muted-foreground">Guests</p>
                  <p>{venue.autoApproveGuests ? "Auto-approved on scan" : "Host approves each table"}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- Navigation ---------- */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || launching}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!stepValid}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={launch} disabled={!stepValid || launching} className="glow-primary">
            {launching ? <Loader2 className="size-4 animate-spin" /> : <PartyPopper className="size-4" />}
            {launching ? "Applying setup…" : "Finish setup"}
          </Button>
        )}
      </div>
    </div>
  );
}
