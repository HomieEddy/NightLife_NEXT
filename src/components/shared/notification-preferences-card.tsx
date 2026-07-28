"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { isDemoMode } from "@/features/shared/app-mode";
import { getVapidPublicKey } from "@/lib/pwa";

type PrefRow = {
  eventType: string;
  push: boolean;
  email: boolean;
  sms: boolean;
};

const EVENT_LABELS: Record<string, string> = {
  OrderPlaced: "New orders",
  OrderStatusChanged: "Order status updates",
  OrderClaimed: "Order claimed",
  OrderReleased: "Order released",
  HelpRequested: "Help requests",
  SessionRequested: "Session requests",
  SessionApproved: "Session approved",
  SessionDenied: "Session denied",
  BroadcastSent: "Staff broadcasts",
  LastCallStarted: "Last call started",
  LastCallEnded: "Last call ended",
  SoldOut: "Items sold out",
  StockRestocked: "Items restocked",
};

const EVENT_TYPES = Object.keys(EVENT_LABELS);

function buildDefaults(): PrefRow[] {
  return EVENT_TYPES.map((et) => ({
    eventType: et,
    push: false,
    email: false,
    sms: false,
  }));
}

export function NotificationPreferencesCard() {
  const demo = isDemoMode();
  if (demo) return <DemoExplainCard />;
  return <LivePreferencesCard />;
}

function DemoExplainCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <BellRing className="size-5 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            Push notifications and notification preferences are available in the
            live build. Staff and managers can choose which events trigger push,
            email, or SMS alerts — per event type, per channel.
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Available events:</p>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPES.map((et) => (
              <div key={et} className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellOff className="size-3.5 shrink-0" />
                {EVENT_LABELS[et] ?? et}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LivePreferencesCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [prefs, setPrefs] = useState<PrefRow[]>(buildDefaults());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) return;
      const data = await res.json();
      setPushEnabled(!!(await navigator.serviceWorker?.getRegistration()));
      const rows = buildDefaults();
      for (const p of data.preferences ?? []) {
        const row = rows.find((r) => r.eventType === p.eventType);
        if (row) {
          if (p.channel === "push") row.push = p.enabled;
          if (p.channel === "email") row.email = p.enabled;
          if (p.channel === "sms") row.sms = p.enabled;
        }
      }
      setPrefs(rows);
    } catch {
      // silent — preferences optional
    } finally {
      setLoading(false);
    }
  }

  async function togglePush() {
    if (pushEnabled) {
      // unsubscribe
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await fetch("/api/push/subscriptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
      } catch { /* silent */ }
      setPushEnabled(false);
      toast.success("Push notifications disabled");
    } else {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission denied");
          return;
        }
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) {
          toast.error("Service worker not ready");
          return;
        }
        const vapidKey = getVapidPublicKey();
        if (!vapidKey) {
          toast.error("Push configuration missing");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ForSubscribe(vapidKey),
        });
        const raw = sub.toJSON();
        await fetch("/api/push/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: raw.endpoint,
            keys: raw.keys,
          }),
        });
        setPushEnabled(true);
        toast.success("Push notifications enabled");
      } catch {
        toast.error("Failed to enable push notifications");
      }
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = prefs.flatMap((r) => [
        { eventType: r.eventType, channel: "push" as const, enabled: r.push },
        { eventType: r.eventType, channel: "email" as const, enabled: r.email },
        { eventType: r.eventType, channel: "sms" as const, enabled: r.sms },
      ]);
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  function toggle(channel: "push" | "email" | "sms", eventType: string) {
    setPrefs((prev) =>
      prev.map((r) => {
        if (r.eventType !== eventType) return r;
        return { ...r, [channel]: !r[channel] };
      }),
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Notifications
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Push notifications</p>
            <p className="text-xs text-muted-foreground">
              Receive alerts on your phone when the app is closed. iOS requires the
              app to be installed to your Home Screen.
            </p>
          </div>
          <Switch checked={pushEnabled} onCheckedChange={togglePush} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Per-event preferences</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="px-2 py-2 text-center font-medium">Push</th>
                  <th className="px-2 py-2 text-center font-medium">Email</th>
                  <th className="px-2 py-2 text-center font-medium">SMS</th>
                </tr>
              </thead>
              <tbody>
                {prefs.map((r) => (
                  <tr key={r.eventType} className="border-b border-border/40">
                    <td className="py-2 pr-3">
                      <Label className="text-sm font-normal cursor-pointer">
                        {EVENT_LABELS[r.eventType] ?? r.eventType}
                      </Label>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Switch
                        checked={r.push}
                        onCheckedChange={() => toggle("push", r.eventType)}
                        disabled={!pushEnabled}
                        className="scale-75"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Switch
                        checked={r.email}
                        onCheckedChange={() => toggle("email", r.eventType)}
                        className="scale-75"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Switch
                        checked={r.sms}
                        onCheckedChange={() => toggle("sms", r.eventType)}
                        className="scale-75"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function urlB64(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64_ = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64_);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function urlB64ForSubscribe(base64: string): BufferSource {
  return urlB64(base64) as unknown as BufferSource;
}
