"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Lock, RotateCcw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { permissionService } from "@/lib/services/permission-service";
import {
  ACTION_META,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/permissions";
import { ASSIGNABLE_ROLES } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ActionCategory, RolePermissions, StaffAction } from "@/lib/permissions";
import type { StaffRole } from "@/lib/types";

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  orders: "Orders",
  guests: "Guest sessions & identity",
  help: "Help & security",
  reservations: "Reservations",
  tab: "Tab ledger",
  operations: "Operations",
  door: "Door & waitlist",
  incidents: "Incidents",
};

// Build once at module load — stable order matches ACTION_META declaration.
const ACTIONS_BY_CATEGORY: Record<ActionCategory, StaffAction[]> = {
  orders: [],
  guests: [],
  help: [],
  reservations: [],
  tab: [],
  operations: [],
  door: [],
  incidents: [],
};
(Object.entries(ACTION_META) as [StaffAction, { category: ActionCategory }][]).forEach(
  ([action, meta]) => { ACTIONS_BY_CATEGORY[meta.category].push(action); },
);
const CATEGORIES: ActionCategory[] = ["door", "orders", "guests", "help", "incidents", "reservations", "tab", "operations"];

// Manager always retains full access — not editable.
const LOCKED_ROLE: StaffRole = "manager";

// ---------- Not-authorized panel ----------

function NotAuthorized() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
        <ShieldOff className="size-8 text-red-600 dark:text-red-400" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">Access restricted</p>
        <p className="text-sm text-muted-foreground">
          Only managers can view and edit role permissions.
        </p>
      </div>
    </div>
  );
}

// ---------- Main tab ----------

export function RolesAccessTab({
  currentUserRole,
  venueId,
}: {
  /** Role of the currently authenticated user — null while loading. */
  currentUserRole: StaffRole | null;
  venueId: string;
}) {
  const [saved, setSaved] = useState<RolePermissions | null>(null);
  const [draft, setDraft] = useState<RolePermissions | null>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole>("host");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const perms = await permissionService.getRolePermissions(venueId);
    setSaved(perms);
    setDraft(structuredClone(perms));
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  // Wait until we know who the user is before rendering anything.
  if (currentUserRole === null) {
    return <ListSkeleton rows={6} rowHeight="h-14" />;
  }

  // Any non-manager who reaches this tab sees the guard.
  if (currentUserRole !== "manager") {
    return <NotAuthorized />;
  }

  if (!draft || !saved) {
    return <ListSkeleton rows={6} rowHeight="h-14" />;
  }

  const isLocked = selectedRole === LOCKED_ROLE;
  const dirty = JSON.stringify(draft[selectedRole]) !== JSON.stringify(saved[selectedRole]);

  function toggle(action: StaffAction) {
    if (isLocked) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const current = prev[selectedRole];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [selectedRole]: next };
    });
  }

  async function saveChanges() {
    if (!draft) return;
    setSaving(true);
    try {
      await permissionService.setRolePermissions(venueId, draft);
      setSaved(structuredClone(draft));
      toast.success(`${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} permissions saved`);
    } catch {
      toast.error("Could not save permissions");
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaults() {
    if (!draft) return;
    const restored = { ...draft, [selectedRole]: [...DEFAULT_ROLE_PERMISSIONS[selectedRole]] };
    setSaving(true);
    try {
      await permissionService.setRolePermissions(venueId, restored);
      setSaved(structuredClone(restored));
      setDraft(restored);
      toast.success(`${selectedRole} permissions reset to defaults`);
    } catch {
      toast.error("Could not reset permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Role selector */}
      <div className="flex flex-wrap gap-1.5">
        {ASSIGNABLE_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setSelectedRole(role)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
              selectedRole === role
                ? "border-primary bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {role === LOCKED_ROLE && <Lock className="size-3" />}
            {role}
          </button>
        ))}
      </div>

      {/* Manager locked notice */}
      {isLocked ? (
        <Card className="border-muted py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <Lock className="size-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              The <span className="font-medium text-foreground">manager</span> role always retains
              full access and cannot be customized.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Capability groups */}
          {CATEGORIES.map((category) => {
            const actions = ACTIONS_BY_CATEGORY[category];
            if (!actions.length) return null;
            return (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[category]}
                </p>
                <div className="space-y-1.5">
                  {actions.map((action) => {
                    const meta = ACTION_META[action];
                    const checked = draft[selectedRole].includes(action);
                    return (
                      <div
                        key={action}
                        className="flex items-center justify-between gap-4 rounded-lg border bg-card/50 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            {meta.label}
                            {meta.sensitive && (
                              <AlertTriangle
                                className="size-3.5 text-amber-500"
                                aria-label="Sensitive — use with care"
                              />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{meta.description}</p>
                        </div>
                        <Switch
                          checked={checked}
                          onCheckedChange={() => toggle(action)}
                          aria-label={meta.label}
                          disabled={saving}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" disabled={saving}>
                  <RotateCcw className="size-3.5" />
                  Restore defaults
                </Button>
              }
              title={`Restore ${selectedRole} defaults?`}
              description={`All capabilities for the ${selectedRole} role will be reset to the app defaults and saved immediately. Other roles are not affected.`}
              confirmLabel="Restore defaults"
              onConfirm={restoreDefaults}
            />
            <ConfirmDialog
              trigger={
                <Button size="sm" disabled={!dirty || saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              }
              title={`Update ${selectedRole} permissions?`}
              description={`These changes apply to all ${selectedRole} team members. Staff on shift will see the new permissions on their next page load.`}
              confirmLabel="Save permissions"
              onConfirm={saveChanges}
            />
          </div>
        </div>
      )}
    </div>
  );
}
