import { z } from "zod";

export { zZoneInput, zTableInput, zTablePatch, zZonePatch } from "@/features/venue/schemas";
export { zCategoryInput, zItemInput, zPackageInput } from "@/features/menu/schemas";
export { zHappyHourInput } from "@/features/menu/schemas";
export { zServiceFee, zOpeningHour } from "@/features/venue/schemas";

export const zStaffInput = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["manager", "host", "bartender", "runner", "security", "promoter"]),
  phone: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  assignedZoneIds: z.array(z.string()).default([]),
  suspended: z.boolean().default(false),
});

export const zGuestInput = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  dobYear: z.number().int().min(1900).max(2026).optional(),
  vipTier: z.enum(["none", "regular", "vip", "host-list"]).default("none"),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
  photoUrl: z.string().default(""),
  preferredDrink: z.string().default(""),
  dietary: z.string().default(""),
  allergies: z.string().default(""),
  celebrationDate: z.string().default(""),
  watchlistReason: z.string().default(""),
  marketingEmail: z.boolean().default(false),
  marketingSms: z.boolean().default(false),
});

export const zPromotionInput = z.object({
  code: z.string().min(1, "Code is required"),
  status: z.enum(["active", "inactive", "scheduled"]).default("active"),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["pct", "flat"]).default("pct"),
  value: z.number().min(0),
  startsAt: z.string().default(""),
  endsAt: z.string().default(""),
  appliesToCategoryIds: z.array(z.string()).default([]),
});

export const zEventInput = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  startsAt: z.string().default(""),
  endsAt: z.string().default(""),
  zoneId: z.string().optional().default(""),
  capacity: z.number().int().positive().default(50),
  status: z.enum(["draft", "published", "cancelled"]).default("draft"),
  guestlistEnabled: z.boolean().default(false),
  ticketEnabled: z.boolean().default(false),
  ticketUrl: z.string().default(""),
});

export const zSupplierInput = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  leadTimeDays: z.number().int().positive().default(7),
  minOrder: z.number().nonnegative().default(0),
});

export const zCategoryEditInput = z.object({
  name: z.string().min(1, "Name is required"),
  sortOrder: z.number().int().nonnegative().default(0),
  description: z.string().default(""),
  isActive: z.boolean().default(true),
});

export const zItemEditInput = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  price: z.number().positive("Price must be positive"),
});

export const zInventoryItemCreateInput = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  categoryId: z.string().min(1, "Category is required"),
  icon: z.string().min(1, "Icon is required"),
  price: z.number().positive("Price must be positive"),
  initialStock: z.number().int().nonnegative().optional(),
});

export const zInventoryItemEditInput = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  categoryId: z.string().min(1, "Category is required"),
  icon: z.string().min(1, "Icon is required"),
  price: z.number().positive("Price must be positive"),
});

export const zAdjustCountInput = z.object({
  count: z.string().min(1, "Count is required"),
  note: z.string().default(""),
});

export const zRecordWasteInput = z.object({
  quantity: z.string().min(1, "Quantity is required"),
  reason: z.string().min(1, "Reason is required"),
});

export const zTipPoolRuleInput = z.object({
  name: z.string().min(1, "Name is required"),
  basis: z.enum(["equal", "hours", "points"]),
  includeRoles: z.array(z.string()).min(1, "At least one role is required"),
  houseRetentionPct: z.number().int().min(0).max(100),
});

export const zReportConfigInput = z.object({
  name: z.string().min(1, "Name is required"),
  rangeDays: z.number().int().positive().default(30),
  metrics: z.array(z.string()).min(1, "At least one metric is required"),
  scheduled: z.boolean().default(false),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  recipient: z.string().email("Invalid email").optional().or(z.literal("")),
});

export const zShiftInput = z.object({
  staffId: z.string().min(1, "Staff member is required"),
  dayOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  zoneId: z.string().optional().default(""),
});

export const zLeadInput = z.object({
  venueName: z.string().min(1, "Venue name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email").min(1, "Email is required"),
  phone: z.string().default(""),
  city: z.string().default(""),
  source: z.enum(["landing-page", "referral", "outbound", "event"]).default("landing-page"),
  dealValue: z.number().nonnegative().optional(),
  notes: z.string().default(""),
});

export const zSupplierCatalogueInput = z.object({
  menuItemId: z.string().min(1, "Item is required"),
  unitCostCents: z.number().int().positive("Cost must be positive"),
  supplierSku: z.string().default(""),
  caseSize: z.number().int().positive().optional(),
  caseCostCents: z.number().int().positive().optional(),
  preferred: z.boolean().default(false),
});

export const zAdjustmentInput = z.object({
  scope: z.enum(["line", "order", "session"]),
  kind: z.enum(["void", "comp", "discount"]),
  reasonCode: z.string().min(1, "Reason is required"),
  note: z.string().default(""),
});

export const zWaitlistEntryInput = z.object({
  name: z.string().min(1, "Guest name is required"),
  partySize: z.number().int().min(1, "Party size must be at least 1").max(50),
  quotedMinutes: z.number().int().min(5).max(180).default(30),
});

export const zIncidentReportInput = z.object({
  type: z.enum(["ejection", "refused-entry", "medical", "altercation", "theft", "property-damage", "police", "staff-injury", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  narrative: z.string().min(1, "Describe what happened"),
  actionsTaken: z.string().min(1, "Describe what you did"),
  policeInvolved: z.boolean().default(false),
  reportable: z.boolean().default(false),
});
