"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { staffService } from "@/lib/services/staff-service";
import { cn } from "@/features/shared/utils";
import { ASSIGNABLE_ROLES, type StaffMember, type StaffRole, type Zone } from "@/lib/types";

interface Draft {
  name: string;
  role: StaffRole;
  phone: string;
  email: string;
  assignedZoneIds: string[];
  suspended: boolean;
}

export function StaffEditDialog({
  open,
  onOpenChange,
  member,
  zones,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StaffMember | null;
  zones: Zone[];
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      member
        ? {
            name: member.name,
            role: member.role,
            phone: member.phone,
            email: member.email,
            assignedZoneIds: member.assignedZoneIds,
            suspended: member.accountStatus === "suspended",
          }
        : { name: "", role: "runner", phone: "", email: "", assignedZoneIds: [], suspended: false },
    );
  }, [open, member]);

  function toggleZone(zoneId: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      assignedZoneIds: draft.assignedZoneIds.includes(zoneId)
        ? draft.assignedZoneIds.filter((id) => id !== zoneId)
        : [...draft.assignedZoneIds, zoneId],
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!draft.email.trim()) {
      toast.error("Email is required — it's the staff login.");
      return;
    }
    setSaving(true);
    const base = {
      name: draft.name.trim(),
      role: draft.role,
      phone: draft.phone.trim(),
      email: draft.email.trim().toLowerCase(),
      assignedZoneIds: draft.assignedZoneIds,
    };
    try {
      if (member) {
        await staffService.updateStaff(member.id, {
          ...base,
          accountStatus: draft.suspended ? "suspended" : member.accountStatus === "suspended" ? "active" : member.accountStatus,
        });
        toast.success(`${base.name} updated`);
      } else {
        await staffService.addStaff({
          venueId: "venue-1",
          ...base,
          accountStatus: "invited",
          isOnShift: false,
        });
        toast.success(`${base.name} invited to the team`);
      }
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the team member.");
    } finally {
      setSaving(false);
    }
  }

  async function resetPin() {
    if (!member) return;
    try {
      await staffService.resendInvite(member.id);
      toast.success(`Invite resent to ${member.email}`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the invitation.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? `Edit ${member.name}` : "Add a team member"}</DialogTitle>
          {!member && (
            <DialogDescription>
              They&apos;ll get an email invite to set up their staff account.
            </DialogDescription>
          )}
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                placeholder="e.g. Marie Dupont"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={draft.role}
                  onValueChange={(v) => setDraft({ ...draft, role: v as StaffRole })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <SelectItem key={role} value={role} className="capitalize">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  placeholder="+33 6 …"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email (login)</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="name@venue.club"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned zones</Label>
              <div className="flex flex-wrap gap-1.5">
                {zones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => toggleZone(zone.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      draft.assignedZoneIds.includes(zone.id)
                        ? "border-primary bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {zone.name}
                  </button>
                ))}
              </div>
            </div>

            {member && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Account</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Suspend access</p>
                    <p className="text-xs text-muted-foreground">
                      Blocks staff panel sign-in until re-activated.
                    </p>
                  </div>
                  <Switch
                    checked={draft.suspended}
                    onCheckedChange={(suspended) => setDraft({ ...draft, suspended })}
                    aria-label="Suspend account"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={resetPin}>
                  <KeyRound className="size-3.5" /> Reset sign-in PIN
                </Button>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : member ? "Save" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
