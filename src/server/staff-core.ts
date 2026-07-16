import type { PrismaClient } from "@prisma/client";
import type { StaffMember, StaffRole } from "@/lib/types";

type OrgRole = "admin" | "member";
type FloorRole = Exclude<StaffRole, "security">;

export function staffRoleToOrgRole(role: FloorRole): OrgRole {
  return role === "manager" ? "admin" : "member";
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function profileToMember(member: {
  user: { id: string; name: string; email: string; banned: boolean | null; staffProfile: {
    phone: string;
    role: string;
    assignedZoneIds: string[];
    isOnShift: boolean;
    avatarInitials: string;
  } | null };
}, venueId: string): StaffMember {
  const profile = member.user.staffProfile;
  return {
    id: member.user.id,
    venueId,
    name: member.user.name,
    role: (profile?.role ?? "runner") as StaffRole,
    phone: profile?.phone ?? "",
    email: member.user.email,
    accountStatus: member.user.banned ? "suspended" : "active",
    assignedZoneIds: profile?.assignedZoneIds ?? [],
    isOnShift: profile?.isOnShift ?? false,
    avatarInitials: profile?.avatarInitials ?? initials(member.user.name),
  };
}

const memberInclude = { user: { include: { staffProfile: true } } } as const;

export async function listStaff(prisma: PrismaClient, venueId: string): Promise<StaffMember[]> {
  const [members, invitations] = await Promise.all([
    prisma.member.findMany({ where: { organizationId: venueId }, include: memberInclude }),
    prisma.invitation.findMany({ where: { organizationId: venueId, status: "pending" } }),
  ]);
  return [
    ...members.map((member) => profileToMember(member, venueId)),
    ...invitations.map((invitation) => ({
      id: invitation.id,
      venueId,
      name: invitation.draftName ?? invitation.email,
      role: (invitation.floorRole ?? "runner") as StaffRole,
      phone: invitation.draftPhone ?? "",
      email: invitation.email,
      accountStatus: "invited" as const,
      assignedZoneIds: invitation.assignedZoneIds,
      isOnShift: false,
      avatarInitials: initials(invitation.draftName ?? invitation.email),
    })),
  ];
}

export async function getCurrentStaff(
  prisma: PrismaClient,
  venueId: string,
  userId: string,
): Promise<StaffMember | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId: venueId, userId },
    include: memberInclude,
  });
  return member ? profileToMember(member, venueId) : null;
}

export async function updateStaff(
  prisma: PrismaClient,
  venueId: string,
  staffId: string,
  patch: Partial<Pick<StaffMember, "name" | "phone" | "assignedZoneIds" | "accountStatus">> & { role?: FloorRole },
): Promise<StaffMember | null> {
  const member = await prisma.member.findFirst({ where: { organizationId: venueId, userId: staffId } });
  if (!member) return null;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: staffId },
      data: {
        name: patch.name,
        banned: patch.accountStatus === undefined ? undefined : patch.accountStatus === "suspended",
      },
    }),
    prisma.staffProfile.upsert({
      where: { userId: staffId },
      create: {
        userId: staffId,
        phone: patch.phone ?? "",
        role: patch.role ?? "runner",
        assignedZoneIds: patch.assignedZoneIds ?? [],
        avatarInitials: initials(patch.name ?? "Staff"),
      },
      update: {
        phone: patch.phone,
        role: patch.role,
        assignedZoneIds: patch.assignedZoneIds,
        avatarInitials: patch.name ? initials(patch.name) : undefined,
      },
    }),
    ...(patch.role ? [prisma.member.update({
      where: { id: member.id },
      data: { role: staffRoleToOrgRole(patch.role) },
    })] : []),
  ]);
  return getCurrentStaff(prisma, venueId, staffId);
}

export async function toggleShift(
  prisma: PrismaClient,
  venueId: string,
  staffId: string,
): Promise<StaffMember | null> {
  const current = await getCurrentStaff(prisma, venueId, staffId);
  if (!current) return null;
  await prisma.staffProfile.update({ where: { userId: staffId }, data: { isOnShift: !current.isOnShift } });
  return getCurrentStaff(prisma, venueId, staffId);
}

export async function removeStaff(prisma: PrismaClient, venueId: string, staffId: string): Promise<boolean> {
  const member = await prisma.member.findFirst({ where: { organizationId: venueId, userId: staffId } });
  if (!member) {
    return prisma.invitation.deleteMany({ where: { id: staffId, organizationId: venueId } })
      .then((result) => result.count > 0);
  }
  await prisma.$transaction([
    prisma.staffShift.deleteMany({ where: { venueId, staffId } }),
    prisma.member.delete({ where: { id: member.id } }),
  ]);
  return true;
}
