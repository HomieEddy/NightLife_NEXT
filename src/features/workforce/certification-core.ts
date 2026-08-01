/**
 * Certification persistence (S-04, plan 17 graduation).
 *
 * `status` is derived, not stored as truth: a row is "expired" the moment
 * expiresAt passes, regardless of what was written. Only "revoked" is a
 * decision a manager makes, so only that one is authoritative in the column.
 */
import type { ScopedDb } from "@/features/shared/db";
import type { Certification, CertificationType } from "@/lib/types";

interface CertificationRow {
  id: string;
  venueId: string;
  staffId: string;
  type: string;
  issuedAt: Date;
  expiresAt: Date;
  issuingBody: string | null;
  referenceNumber: string | null;
  verifiedByStaffId: string | null;
  verifiedAt: Date | null;
  status: string;
}

function toCertification(row: CertificationRow): Certification {
  const revoked = row.status === "revoked";
  return {
    id: row.id,
    venueId: row.venueId,
    staffId: row.staffId,
    type: row.type as CertificationType,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    issuingBody: row.issuingBody ?? undefined,
    referenceNumber: row.referenceNumber ?? undefined,
    verifiedByStaffId: row.verifiedByStaffId ?? undefined,
    verifiedAt: row.verifiedAt?.toISOString(),
    status: revoked ? "revoked" : row.expiresAt < new Date() ? "expired" : "active",
  };
}

export async function listCertifications(
  db: ScopedDb,
  staffId?: string,
): Promise<Certification[]> {
  const rows = await db.certification.findMany({
    where: staffId ? { staffId } : {},
    orderBy: { expiresAt: "desc" },
  });
  return rows.map(toCertification);
}

export async function getCertification(
  db: ScopedDb,
  id: string,
): Promise<Certification | null> {
  const row = await db.certification.findFirst({ where: { id } });
  return row ? toCertification(row) : null;
}

export async function createCertification(
  db: ScopedDb,
  venueId: string,
  input: {
    staffId: string;
    type: CertificationType;
    issuedAt: string;
    expiresAt: string;
    issuingBody?: string;
    referenceNumber?: string;
    createdByStaffId: string;
  },
): Promise<Certification> {
  const expiresAt = new Date(input.expiresAt);
  const row = await db.certification.create({
    data: {
      venueId,
      staffId: input.staffId,
      type: input.type,
      issuedAt: new Date(input.issuedAt),
      expiresAt,
      issuingBody: input.issuingBody ?? null,
      referenceNumber: input.referenceNumber ?? null,
      verifiedByStaffId: input.createdByStaffId,
      verifiedAt: new Date(),
      status: expiresAt < new Date() ? "expired" : "active",
    },
  });
  return toCertification(row);
}

export async function updateCertification(
  db: ScopedDb,
  id: string,
  patch: { expiresAt?: string; issuingBody?: string; referenceNumber?: string },
): Promise<Certification | null> {
  const existing = await db.certification.findFirst({ where: { id } });
  if (!existing) return null;

  const expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : existing.expiresAt;
  const row = await db.certification.update({
    where: { id },
    data: {
      expiresAt,
      issuingBody: patch.issuingBody !== undefined ? patch.issuingBody : existing.issuingBody,
      referenceNumber:
        patch.referenceNumber !== undefined ? patch.referenceNumber : existing.referenceNumber,
      // A revoked certification stays revoked — renewing the date doesn't undo it.
      status: existing.status === "revoked"
        ? "revoked"
        : expiresAt < new Date() ? "expired" : "active",
    },
  });
  return toCertification(row);
}

export async function revokeCertification(
  db: ScopedDb,
  id: string,
): Promise<Certification | null> {
  const existing = await db.certification.findFirst({ where: { id } });
  if (!existing) return null;
  const row = await db.certification.update({ where: { id }, data: { status: "revoked" } });
  return toCertification(row);
}

export async function verifyCertification(
  db: ScopedDb,
  id: string,
  verifierStaffId: string,
): Promise<Certification | null> {
  const existing = await db.certification.findFirst({ where: { id } });
  if (!existing) return null;
  const row = await db.certification.update({
    where: { id },
    data: { verifiedByStaffId: verifierStaffId, verifiedAt: new Date() },
  });
  return toCertification(row);
}
