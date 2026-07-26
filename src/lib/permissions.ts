import type { StaffRole } from "./types";

// ---------- Action definitions ----------

export type StaffAction =
  | "order:accept"       // pending → accepted (commits the bar)
  | "order:claim"        // take ownership of an accepted order
  | "order:release"      // return to unclaimed pool
  | "order:transition"   // accepted → preparing → ready → delivered
  | "order:gift"         // waive the full order total
  | "session:approve"    // allow a guest party to open a tab
  | "session:deny"       // turn away a join request
  | "help:respond"       // acknowledge and resolve help requests
  | "reservation:create-own"
  | "reservation:edit-own"
  | "reservation:cancel-own"
  | "reservation:confirm-own";

export type ActionCategory = "orders" | "guests" | "help" | "reservations";

/** Metadata for each action — consumed by a future role-editor UI. */
export interface ActionMeta {
  label: string;
  description: string;
  category: ActionCategory;
  /** True for actions with broader blast radius (gift, deny) — warrants a warning in the editor. */
  sensitive?: boolean;
}

export const ACTION_META: Record<StaffAction, ActionMeta> = {
  "order:accept": {
    label: "Accept orders",
    description: "Move a pending order to accepted, committing the bar to fulfil it.",
    category: "orders",
  },
  "order:claim": {
    label: "Claim orders",
    description: "Take ownership of an accepted order for delivery.",
    category: "orders",
  },
  "order:release": {
    label: "Release orders",
    description: "Return a claimed order to the unclaimed pool.",
    category: "orders",
  },
  "order:transition": {
    label: "Advance order status",
    description: "Move an order through preparing → ready → delivered.",
    category: "orders",
  },
  "order:gift": {
    label: "Comp / gift orders",
    description: "Waive the full order total as a house gift.",
    category: "orders",
    sensitive: true,
  },
  "session:approve": {
    label: "Approve table sessions",
    description: "Allow a guest party to open a tab at their table.",
    category: "guests",
  },
  "session:deny": {
    label: "Deny table sessions",
    description: "Turn away a guest join request.",
    category: "guests",
    sensitive: true,
  },
  "help:respond": {
    label: "Respond to help requests",
    description: "Acknowledge and resolve guest help and security requests.",
    category: "help",
  },
  "reservation:create-own": {
    label: "Create reservations",
    description: "Submit new reservation requests for assigned guests.",
    category: "reservations",
  },
  "reservation:edit-own": {
    label: "Edit own reservations",
    description: "Update the details of reservations this staff member created.",
    category: "reservations",
  },
  "reservation:cancel-own": {
    label: "Cancel own reservations",
    description: "Cancel reservations this staff member created.",
    category: "reservations",
    sensitive: true,
  },
  "reservation:confirm-own": {
    label: "Confirm own reservations",
    description: "Promote a requested reservation to confirmed status.",
    category: "reservations",
  },
};

// ---------- Permission matrix ----------

/**
 * Serialisable capability record — suitable for DB storage and API transport.
 * Use arrays (not Sets) so values round-trip through JSON without loss.
 *
 * TODO(backend): backed by a venue_role_permissions table.
 * Each row stores (venueId, role, actions[]) and is merged over DEFAULT_ROLE_PERMISSIONS
 * so tenants only need to record the delta from the defaults.
 */
export type RolePermissions = Record<StaffRole, StaffAction[]>;

/** Baseline capabilities shipped with the app. Tenants may override per-venue. */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  manager: [
    "order:accept", "order:claim", "order:release", "order:transition", "order:gift",
    "session:approve", "session:deny", "help:respond",
  ],
  host: [
    "order:accept", "order:claim", "order:release", "order:transition", "order:gift",
    "session:approve", "session:deny", "help:respond",
  ],
  bartender: [
    "order:accept", "order:claim", "order:release", "order:transition",
    "help:respond",
  ],
  // Fulfillment only — can move orders forward but cannot accept new ones.
  runner: [
    "order:claim", "order:release", "order:transition",
    "help:respond",
  ],
  // Security — incident response only, no order or session authority.
  security: [
    "help:respond",
  ],
  promoter: [
    "reservation:create-own", "reservation:edit-own",
    "reservation:cancel-own", "reservation:confirm-own",
  ],
};

// ---------- Pure permission check ----------

/**
 * Returns true if `role` has `action` in the provided permission set.
 *
 * Pure and synchronous — pass the RolePermissions loaded from permissionService
 * so the check reflects any per-tenant overrides.
 */
export function canDo(
  permissions: RolePermissions,
  role: StaffRole,
  action: StaffAction,
): boolean {
  return permissions[role]?.includes(action) ?? false;
}
