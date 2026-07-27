/**
 * mockCertificationService — staff certification tracking (S-04, plan 17).
 * Certifications gate shift publishing and feed Pulse expiry warnings.
 * Live mode persists this as a tenant-scoped certifications table.
 */
import type { Certification, CertificationType } from "@/lib/types";
import { mockCertifications } from "@/lib/mock-data/certifications";
import { mockVenue } from "@/lib/mock-data/venue";
import { clone, delay, uid } from "./delay";
import { mockAuditService } from "./audit-service";

let certifications: Certification[] = clone(mockCertifications);

export const mockCertificationService = {
  async listCertifications(staffId?: string): Promise<Certification[]> {
    await delay(150);
    const result = staffId
      ? certifications.filter((c) => c.staffId === staffId)
      : certifications;
    return clone(result).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
  },

  async getCertification(id: string): Promise<Certification | null> {
    await delay(100);
    return clone(certifications.find((c) => c.id === id) ?? null);
  },

  async createCertification(input: {
    staffId: string;
    type: CertificationType;
    issuedAt: string;
    expiresAt: string;
    issuingBody?: string;
    referenceNumber?: string;
    createdByStaffId: string;
    createdByStaffName: string;
  }): Promise<Certification> {
    await delay(300);
    const now = new Date().toISOString();
    const status = new Date(input.expiresAt) < new Date() ? "expired" : "active";
    const cert: Certification = {
      id: uid("cert"),
      venueId: mockVenue.id,
      staffId: input.staffId,
      type: input.type,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      issuingBody: input.issuingBody,
      referenceNumber: input.referenceNumber,
      verifiedByStaffId: input.createdByStaffId,
      verifiedAt: now,
      status,
    };
    certifications = [cert, ...certifications];
    await mockAuditService.record({
      actorStaffId: input.createdByStaffId,
      actorName: input.createdByStaffName,
      action: "certification:manage",
      targetType: "certification",
      targetId: cert.id,
      summary: `Created ${input.type} certification for staff — expires ${input.expiresAt}`,
      metadata: { staffId: input.staffId },
    });
    return clone(cert);
  },

  async revokeCertification(id: string, staffId: string, staffName: string): Promise<Certification | null> {
    await delay(250);
    const cert = certifications.find((c) => c.id === id);
    if (!cert) return null;
    cert.status = "revoked";
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "certification:manage",
      targetType: "certification",
      targetId: id,
      summary: `Revoked ${cert.type} certification`,
      metadata: { staffId: cert.staffId },
    });
    return clone(cert);
  },

  async verifyCertification(id: string, staffId: string, staffName: string): Promise<Certification | null> {
    await delay(250);
    const cert = certifications.find((c) => c.id === id);
    if (!cert) return null;
    cert.verifiedByStaffId = staffId;
    cert.verifiedAt = new Date().toISOString();
    return clone(cert);
  },

  async updateCertification(
    id: string,
    patch: { expiresAt?: string; issuingBody?: string; referenceNumber?: string },
  ): Promise<Certification | null> {
    await delay(250);
    const cert = certifications.find((c) => c.id === id);
    if (!cert) return null;
    if (patch.expiresAt) cert.expiresAt = patch.expiresAt;
    if (patch.issuingBody !== undefined) cert.issuingBody = patch.issuingBody;
    if (patch.referenceNumber !== undefined) cert.referenceNumber = patch.referenceNumber;
    cert.status = new Date(cert.expiresAt) < new Date() ? "expired" : "active";
    return clone(cert);
  },
};
