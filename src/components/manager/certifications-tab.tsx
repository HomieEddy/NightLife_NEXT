"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, ShieldOff, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { Pagination, paginate } from "@/components/shared/pagination";
import { certificationService } from "@/lib/services/certification-service";
import { staffService } from "@/lib/services/staff-service";
import { CERTIFICATION_TYPE_LABELS, type Certification, type CertificationType, type StaffMember } from "@/lib/types";

type CertificationTypeEntry = [CertificationType, string];

export function CertificationsTab() {
  const [certs, setCerts] = useState<Certification[] | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Certification | null>(null);
  const [staffId, setStaffId] = useState("");
  const [certType, setCertType] = useState<CertificationType>("smart-serve");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [busy, setBusy] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([
      certificationService.listCertifications(),
      staffService.listStaff(),
    ]);
    setCerts(c);
    setStaffList(s);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const staffName = (id: string) => staffList.find((s) => s.id === id)?.name ?? id;

  const visible = useMemo(() => {
    let result = certs ?? [];
    if (typeFilter !== "all") result = result.filter((c) => c.type === typeFilter);
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (staffFilter !== "all") result = result.filter((c) => c.staffId === staffFilter);
    return result;
  }, [certs, typeFilter, statusFilter, staffFilter]);

  function startEdit(cert: Certification) {
    setEditing(cert);
    setExpiresAt(new Date(cert.expiresAt).toISOString().slice(0, 10));
    setIssuingBody(cert.issuingBody ?? "");
    setRefNumber(cert.referenceNumber ?? "");
  }

  function cancelEdit() {
    setEditing(null);
    setExpiresAt("");
    setIssuingBody("");
    setRefNumber("");
  }

  function cancelCreate() {
    setShowCreate(false);
    setStaffId("");
    setExpiresAt("");
    setIssuingBody("");
    setRefNumber("");
  }

  async function createCert() {
    if (!staffId || !expiresAt) return;
    setBusy(true);
    try {
      const me = await staffService.getCurrentStaff();
      await certificationService.createCertification({
        staffId,
        type: certType,
        issuedAt: new Date(issuedAt + "T00:00:00").toISOString(),
        expiresAt: new Date(expiresAt + "T00:00:00").toISOString(),
        issuingBody: issuingBody.trim() || undefined,
        referenceNumber: refNumber.trim() || undefined,
        createdByStaffId: me.id,
        createdByStaffName: me.name,
      });
      toast.success("Certification added");
      cancelCreate();
      await refresh();
    } catch {
      toast.error("Could not add certification");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing || !expiresAt) return;
    setBusy(true);
    try {
      await certificationService.updateCertification(editing.id, {
        expiresAt: new Date(expiresAt + "T00:00:00").toISOString(),
        issuingBody: issuingBody.trim() || undefined,
        referenceNumber: refNumber.trim() || undefined,
      });
      toast.success("Certification updated");
      cancelEdit();
      await refresh();
    } catch {
      toast.error("Could not update certification");
    } finally {
      setBusy(false);
    }
  }

  async function revokeCert(certId: string) {
    const me = await staffService.getCurrentStaff();
    await certificationService.revokeCertification(certId, me.id, me.name);
    toast.success("Certification revoked");
    await refresh();
  }

  async function verifyCert(certId: string) {
    const me = await staffService.getCurrentStaff();
    await certificationService.verifyCertification(certId, me.id, me.name);
    toast.success("Certification verified");
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {visible.length} of {certs?.length ?? 0} certification{visible.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} disabled={showCreate || !!editing}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.entries(CERTIFICATION_TYPE_LABELS) as CertificationTypeEntry[]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={staffFilter} onValueChange={(v) => { setStaffFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Staff member</Label>
                <Select value={staffId} onValueChange={setStaffId}>
                  <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={certType} onValueChange={(v) => setCertType(v as CertificationType)}>
                  <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CERTIFICATION_TYPE_LABELS) as CertificationTypeEntry[]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cert-issued">Issued</Label>
                <Input id="cert-issued" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-expires">Expires</Label>
                <Input id="cert-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cert-body">Issuing body</Label>
                <Input id="cert-body" value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} className="h-9" placeholder="e.g. Croix-Rouge" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-ref">Reference #</Label>
                <Input id="cert-ref" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} className="h-9" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-9 flex-1" onClick={cancelCreate}>Cancel</Button>
              <Button className="h-9 flex-1" disabled={!staffId || !expiresAt || busy} onClick={createCert}>
                Save certification
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit form */}
      {editing && (
        <Card className="border-primary/40">
          <CardContent className="space-y-3 px-4 pt-4">
            <p className="text-sm font-medium">
              Edit {CERTIFICATION_TYPE_LABELS[editing.type]} — {staffName(editing.staffId)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-expires">Expires</Label>
                <Input id="edit-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-body">Issuing body</Label>
                <Input id="edit-body" value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-ref">Reference #</Label>
                <Input id="edit-ref" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-9 flex-1" onClick={cancelEdit}>Cancel</Button>
              <Button className="h-9 flex-1" disabled={!expiresAt || busy} onClick={saveEdit}>
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {certs === null ? (
        <ListSkeleton rows={3} rowHeight="h-14" />
      ) : visible.length === 0 ? (
        <EmptyState icon={ShieldOff} title="No certifications match" description="Add a certification for a staff member to start tracking." />
      ) : (
        <>
        <div className="space-y-2">
          {paginate(visible, page).map((cert) => (
            <Card key={cert.id}>
              <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {CERTIFICATION_TYPE_LABELS[cert.type] ?? cert.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {staffName(cert.staffId)}
                    {cert.issuingBody && ` · ${cert.issuingBody}`}
                    {cert.referenceNumber && ` · #${cert.referenceNumber}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(cert.expiresAt).toLocaleDateString()}
                    {" · "}
                    <span className={cert.status === "expired" ? "text-red-600" : cert.status === "revoked" ? "text-muted-foreground line-through" : "text-emerald-600"}>
                      {cert.status}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {cert.status === "active" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-8" aria-label="Edit" onClick={() => startEdit(cert)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <ConfirmDialog
                        trigger={<Button size="sm" variant="outline" className="h-8 text-xs">Verify</Button>}
                        title="Verify this certification?"
                        description="Records that you've checked this document and updates the verified-at timestamp."
                        confirmLabel="Verify"
                        onConfirm={() => verifyCert(cert.id)}
                      />
                      <ConfirmDialog
                        trigger={<Button size="sm" variant="outline" className="h-8 text-xs text-red-600" aria-label="Revoke">Revoke</Button>}
                        title="Revoke this certification?"
                        description={`This permanently revokes ${staffName(cert.staffId)}'s ${CERTIFICATION_TYPE_LABELS[cert.type]}.`}
                        confirmLabel="Revoke"
                        destructive
                        onConfirm={() => revokeCert(cert.id)}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination totalItems={visible.length} currentPage={page} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
