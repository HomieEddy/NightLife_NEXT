"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { certificationService } from "@/features/workforce/certification-service";
import { staffService } from "@/features/workforce/staff-service";
import { certificationKeys, staffKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import { CERTIFICATION_TYPE_LABELS, type Certification, type CertificationType } from "@/lib/types";
import { z } from "zod";

type CertificationTypeEntry = [CertificationType, string];

export function CertificationsTab() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Certification | null>(null);

  const t = useTranslations("shared");

  const zCertCreate = useMemo(() => z.object({
    staffId: z.string().min(1, t("certifications.validation.staffRequired")),
    certType: z.enum(["smart-serve", "first-aid", "security-licence", "food-handler", "other"] as const).default("smart-serve"),
    issuedAt: z.string().min(1, t("certifications.validation.issueDateRequired")),
    expiresAt: z.string().min(1, t("certifications.validation.expiryDateRequired")),
    issuingBody: z.string().default(""),
    refNumber: z.string().default(""),
  }), [t]);

  type CreateValues = z.infer<typeof zCertCreate>;
  const EMPTY_CREATE = useMemo<CreateValues>(() => ({ staffId: "", certType: "smart-serve", issuedAt: new Date().toISOString().slice(0, 10), expiresAt: "", issuingBody: "", refNumber: "" }), []);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");

  const { register: regCreate, handleSubmit: hsCreate, reset: resetCreate, setValue: svCreate, watch: watchCreate, formState: { errors: errsCreate, isSubmitting: subCreate } } = useForm({
    resolver: zodResolver(zCertCreate),
    defaultValues: EMPTY_CREATE,
  });

  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editIssuingBody, setEditIssuingBody] = useState("");
  const [editRefNumber, setEditRefNumber] = useState("");

  const { data: certs } = useQuery({
    queryKey: certificationKeys.all(venueId),
    queryFn: () => certificationService.listCertifications(),
    enabled: !!venueId,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: staffKeys.list(venueId),
    queryFn: () => staffService.listStaff(),
    enabled: !!venueId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: certificationKeys.all(venueId) });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateValues) => {
      const me = await staffService.getCurrentStaff();
      return certificationService.createCertification({
        staffId: data.staffId,
        type: data.certType as CertificationType,
        issuedAt: new Date(data.issuedAt + "T00:00:00").toISOString(),
        expiresAt: new Date(data.expiresAt + "T00:00:00").toISOString(),
        issuingBody: data.issuingBody.trim() || undefined,
        referenceNumber: data.refNumber.trim() || undefined,
        createdByStaffId: me.id,
        createdByStaffName: me.name,
      });
    },
    onSuccess: () => {
      toast.success(t("certifications.addSuccess"));
      setShowCreate(false);
      resetCreate(EMPTY_CREATE);
      invalidate();
    },
    onError: () => {
      toast.error(t("certifications.addError"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing || !editExpiresAt) throw new Error("Missing data");
      return certificationService.updateCertification(editing.id, {
        expiresAt: new Date(editExpiresAt + "T00:00:00").toISOString(),
        issuingBody: editIssuingBody.trim() || undefined,
        referenceNumber: editRefNumber.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("certifications.updateSuccess"));
      setEditing(null);
      setEditExpiresAt("");
      setEditIssuingBody("");
      setEditRefNumber("");
      invalidate();
    },
    onError: () => {
      toast.error(t("certifications.updateError"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (certId: string) => {
      const me = await staffService.getCurrentStaff();
      return certificationService.revokeCertification(certId, me.id, me.name);
    },
    onSuccess: () => {
      toast.success(t("certifications.revokeSuccess"));
      invalidate();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (certId: string) => {
      const me = await staffService.getCurrentStaff();
      return certificationService.verifyCertification(certId, me.id, me.name);
    },
    onSuccess: () => {
      toast.success(t("certifications.verifySuccess"));
      invalidate();
    },
  });

  const staffName = (id: string) => staffList.find((s) => s.id === id)?.name ?? id;
  const tCertType = (type: CertificationType) => t(`certifications.types.${type}` as any);
  const tStatus = (status: string) => {
    if (status === "active") return t("certifications.statusActive");
    if (status === "expired") return t("certifications.statusExpired");
    if (status === "revoked") return t("certifications.statusRevoked");
    return status;
  };

  const visible = useMemo(() => {
    let result = certs ?? [];
    if (typeFilter !== "all") result = result.filter((c) => c.type === typeFilter);
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (staffFilter !== "all") result = result.filter((c) => c.staffId === staffFilter);
    return result;
  }, [certs, typeFilter, statusFilter, staffFilter]);

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [typeFilter, statusFilter, staffFilter, reset]);

  function startEdit(cert: Certification) {
    setEditing(cert);
    setEditExpiresAt(new Date(cert.expiresAt).toISOString().slice(0, 10));
    setEditIssuingBody(cert.issuingBody ?? "");
    setEditRefNumber(cert.referenceNumber ?? "");
  }

  function cancelEdit() {
    setEditing(null);
    setEditExpiresAt("");
    setEditIssuingBody("");
    setEditRefNumber("");
  }

  function cancelCreate() {
    setShowCreate(false);
    resetCreate(EMPTY_CREATE);
  }

  const onCreateCert = hsCreate(async (data) => {
    createMutation.mutate(data);
  });

  async function saveEdit() {
    updateMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("certifications.countOf", { visible: visible.length, total: certs?.length ?? 0 })}
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} disabled={showCreate || !!editing}>
          <Plus className="size-3.5" /> {t("certifications.addButton")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("certifications.filterType")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("certifications.filterAllTypes")}</SelectItem>
              {(Object.entries(CERTIFICATION_TYPE_LABELS) as CertificationTypeEntry[]).map(([value]) => (
                <SelectItem key={value} value={value}>{tCertType(value as CertificationType)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("certifications.filterStatus")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("certifications.filterAllStatuses")}</SelectItem>
              <SelectItem value="active">{t("certifications.statusActive")}</SelectItem>
              <SelectItem value="expired">{t("certifications.statusExpired")}</SelectItem>
              <SelectItem value="revoked">{t("certifications.statusRevoked")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("certifications.filterStaff")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("certifications.filterAllStaff")}</SelectItem>
              {staffList.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Create form */}
      {showCreate && (
        <Card className="border-primary/40">
          <CardContent className="space-y-3 px-4 pt-4">
            <form onSubmit={onCreateCert}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("certifications.staffMember")}</Label>
                <Select value={watchCreate("staffId")} onValueChange={(v) => svCreate("staffId", v)}>
                  <SelectTrigger className="h-9 w-full"><SelectValue placeholder={t("certifications.selectPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errsCreate.staffId && <p className="text-xs text-red-600">{errsCreate.staffId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("certifications.typeLabel")}</Label>
                <Select value={watchCreate("certType")} onValueChange={(v) => svCreate("certType", v as CreateValues["certType"])}>
                  <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CERTIFICATION_TYPE_LABELS) as CertificationTypeEntry[]).map(([value]) => (
                      <SelectItem key={value} value={value}>{tCertType(value as CertificationType)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cert-issued">{t("certifications.issued")}</Label>
                <Input id="cert-issued" type="date" {...regCreate("issuedAt")} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-expires">{t("certifications.expires")}</Label>
                <Input id="cert-expires" type="date" {...regCreate("expiresAt")} className="h-9" />
                {errsCreate.expiresAt && <p className="text-xs text-red-600">{errsCreate.expiresAt.message}</p>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cert-body">{t("certifications.issuingBody")}</Label>
                <Input id="cert-body" {...regCreate("issuingBody")} className="h-9" placeholder={t("certifications.issuingBodyPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-ref">{t("certifications.referenceNumber")}</Label>
                <Input id="cert-ref" {...regCreate("refNumber")} className="h-9" placeholder={t("certifications.referencePlaceholder")} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" className="h-9 flex-1" onClick={cancelCreate}>{t("certifications.cancel")}</Button>
              <Button type="submit" className="h-9 flex-1" disabled={subCreate || createMutation.isPending}>
                {t("certifications.saveCertification")}
              </Button>
            </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit form */}
      {editing && (
        <Card className="border-primary/40">
          <CardContent className="space-y-3 px-4 pt-4">
            <p className="text-sm font-medium">
              {t("certifications.editTitle", { type: tCertType(editing.type), staff: staffName(editing.staffId) })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-expires">{t("certifications.expires")}</Label>
                <Input id="edit-expires" type="date" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-body">{t("certifications.issuingBody")}</Label>
                <Input id="edit-body" value={editIssuingBody} onChange={(e) => setEditIssuingBody(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-ref">{t("certifications.referenceNumber")}</Label>
                <Input id="edit-ref" value={editRefNumber} onChange={(e) => setEditRefNumber(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" className="h-9 flex-1" onClick={cancelEdit}>{t("certifications.cancel")}</Button>
              <Button className="h-9 flex-1" disabled={!editExpiresAt || updateMutation.isPending} onClick={saveEdit}>
                {t("certifications.saveChanges")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {certs === undefined ? (
        <ListSkeleton rows={3} rowHeight="h-14" />
      ) : visible.length === 0 ? (
        <EmptyState icon={ShieldOff} title={t("certifications.emptyTitle")} description={t("certifications.emptyDesc")} />
      ) : (
        <>
        <div className="space-y-2">
          {sliced.map((cert) => (
            <Card key={cert.id}>
              <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {tCertType(cert.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {staffName(cert.staffId)}
                    {cert.issuingBody && ` · ${cert.issuingBody}`}
                    {cert.referenceNumber && ` · #${cert.referenceNumber}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("certifications.expiresLabel")} {new Date(cert.expiresAt).toLocaleDateString()}
                    {" · "}
                    <span className={cert.status === "expired" ? "text-red-600" : cert.status === "revoked" ? "text-muted-foreground line-through" : "text-emerald-600"}>
                      {tStatus(cert.status)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {cert.status === "active" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-8" aria-label={t("certifications.editAria")} onClick={() => startEdit(cert)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <ConfirmDialog
                        trigger={<Button size="sm" variant="outline" className="h-8 text-xs">{t("certifications.verifyButton")}</Button>}
                        title={t("certifications.verifyTitle")}
                        description={t("certifications.verifyDesc")}
                        confirmLabel={t("certifications.verifyConfirm")}
                        onConfirm={() => verifyMutation.mutate(cert.id)}
                      />
                      <ConfirmDialog
                        trigger={<Button size="sm" variant="outline" className="h-8 text-xs text-red-600" aria-label={t("certifications.revokeAria")}>{t("certifications.revokeButton")}</Button>}
                        title={t("certifications.revokeTitle")}
                        description={t("certifications.revokeDesc", { staff: staffName(cert.staffId), type: tCertType(cert.type) })}
                        confirmLabel={t("certifications.revokeConfirm")}
                        destructive
                        onConfirm={() => revokeMutation.mutate(cert.id)}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
        </>
      )}
    </div>
  );
}
