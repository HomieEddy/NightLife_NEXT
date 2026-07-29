"use client";

import { useEffect } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { staffService } from "@/features/workforce/staff-service";
import { cn } from "@/features/shared/utils";
import { zStaffInput } from "@/lib/form-schemas";
import { ASSIGNABLE_ROLES, type StaffMember, type Zone } from "@/lib/types";
import type { z } from "zod";

type FormValues = z.infer<typeof zStaffInput>;
const EMPTY_VALUES: FormValues = { name: "", role: "runner", phone: "", email: "", assignedZoneIds: [], suspended: false };

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
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(zStaffInput),
    defaultValues: EMPTY_VALUES,
  });
  const assignedZoneIds = watch("assignedZoneIds");
  const suspended = watch("suspended");

  useEffect(() => {
    if (!open) return;
    if (member) {
      reset({
        name: member.name,
        role: member.role,
        phone: member.phone,
        email: member.email,
        assignedZoneIds: member.assignedZoneIds,
        suspended: member.accountStatus === "suspended",
      });
    } else {
      reset(EMPTY_VALUES);
    }
  }, [open, member, reset]);

  function toggleZone(zoneId: string) {
    setValue("assignedZoneIds",
      (assignedZoneIds ?? []).includes(zoneId)
        ? (assignedZoneIds ?? []).filter((id) => id !== zoneId)
        : [...(assignedZoneIds ?? []), zoneId],
    );
  }

  const onSave = handleSubmit(async (data) => {
    const base = {
      name: data.name.trim(),
      role: data.role,
      phone: data.phone?.trim() ?? "",
      email: data.email?.trim().toLowerCase() ?? "",
      assignedZoneIds: data.assignedZoneIds ?? [],
    };
    try {
      if (member) {
        await staffService.updateStaff(member.id, {
          ...base,
          accountStatus: data.suspended ? "suspended" : member.accountStatus === "suspended" ? "active" : member.accountStatus,
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
    }
  });

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
        <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full name</Label>
              <Input id="staff-name" placeholder="e.g. Marie Dupont" {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={watch("role")} onValueChange={(v) => setValue("role", v as FormValues["role"])}>
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
                <Input id="staff-phone" placeholder="+33 6 …" {...register("phone")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email (login)</Label>
              <Input id="staff-email" type="email" placeholder="name@venue.club" {...register("email")} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
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
                      (assignedZoneIds ?? []).includes(zone.id)
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
                    checked={suspended}
                    onCheckedChange={(v) => setValue("suspended", v)}
                    aria-label="Suspend account"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={resetPin}>
                  <KeyRound className="size-3.5" /> Reset sign-in PIN
                </Button>
              </div>
            )}
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Saving…" : member ? "Save" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
