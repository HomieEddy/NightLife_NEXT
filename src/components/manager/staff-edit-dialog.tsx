"use client";

import { useEffect } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { useAuth } from "@/context/auth-context";
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
  const { user } = useAuth();
  const t = useTranslations("shared");
  const venueId = user?.venueId ?? "";
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
        toast.success(t("staffEdit.updatedToast", { name: base.name }));
      } else {
        await staffService.addStaff({
          venueId,
          ...base,
          accountStatus: "invited",
          isOnShift: false,
        });
        toast.success(t("staffEdit.invitedToast", { name: base.name }));
      }
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("staffEdit.saveError"));
    }
  });

  async function resetPin() {
    if (!member) return;
    try {
      await staffService.resendInvite(member.id);
      toast.success(t("staffEdit.resendToast", { email: member.email }));
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("staffEdit.resendError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? t("staffEdit.editTitle", { name: member.name }) : t("staffEdit.addTitle")}</DialogTitle>
          {!member && (
            <DialogDescription>
              {t("staffEdit.inviteDescription")}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">{t("staffEdit.fullName")}</Label>
              <Input id="staff-name" placeholder={t("staffEdit.fullNamePlaceholder")} {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("staffEdit.role")}</Label>
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
                <Label htmlFor="staff-phone">{t("staffEdit.phone")}</Label>
                <Input id="staff-phone" placeholder={t("staffEdit.phonePlaceholder")} {...register("phone")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">{t("staffEdit.emailLogin")}</Label>
              <Input id="staff-email" type="email" placeholder={t("staffEdit.emailPlaceholder")} {...register("email")} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("staffEdit.assignedZones")}</Label>
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
                <p className="text-sm font-medium">{t("staffEdit.account")}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{t("staffEdit.suspendAccess")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("staffEdit.suspendDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={suspended}
                    onCheckedChange={(v) => setValue("suspended", v)}
                    aria-label={t("staffEdit.suspendAria")}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={resetPin}>
                  <KeyRound className="size-3.5" /> {t("staffEdit.resetPin")}
                </Button>
              </div>
            )}
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("staffEdit.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? t("staffEdit.saving") : member ? t("staffEdit.save") : t("staffEdit.sendInvite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
