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
  | "reservation:confirm-own"
  | "tab:void"              // remove a line from revenue and return stock
  | "tab:comp"              // waive a line, stock stays depleted (≤ venue comp threshold)
  | "tab:transfer"          // move an open session to another table
  | "tab:merge"             // fold one session's tab into another's
  | "tab:discount"          // reduce a line's revenue by a delta
  | "tab:override-minimum"  // change a snapshotted minimum-spend commitment
  | "cashout:close"         // close a shift/venue cash-out reconciliation
  | "audit:read"            // view the venue-wide audit trail
  | "door:count"                  // adjust the live occupancy counter
  | "door:admit"                  // admit a walk-in, reservation or guestlist arrival
  | "door:admit-banned-override"  // admit a banned profile anyway (always audited)
  | "door:id-check"               // record an ID check at the door
  | "waitlist:manage"             // add/notify/remove walk-in waitlist entries
  | "incident:create"             // file an incident report
  | "incident:read-all"           // view the venue-wide incident log
  | "guest:read-profile"          // view a guest profile (security sees flags only)
  | "guest:edit-profile"          // edit a guest profile's details/tags
  | "guest:ban"                   // set/lift a guest's banned status
  | "service:refuse";             // refuse further service to a session

export type ActionCategory = "orders" | "guests" | "help" | "reservations" | "tab" | "operations" | "door" | "incidents";

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
  "tab:void": {
    label: "Void order lines",
    description: "Remove a wrongly-rung line from revenue and return the stock to inventory.",
    category: "tab",
    sensitive: true,
  },
  "tab:comp": {
    label: "Comp order lines",
    description: "Waive a line as a house gift, up to the venue's comp threshold. Stock stays depleted.",
    category: "tab",
    sensitive: true,
  },
  "tab:discount": {
    label: "Discount order lines",
    description: "Reduce a line's revenue by a negotiated delta.",
    category: "tab",
    sensitive: true,
  },
  "tab:transfer": {
    label: "Transfer sessions",
    description: "Move an open tab from one table to another.",
    category: "tab",
    sensitive: true,
  },
  "tab:merge": {
    label: "Merge sessions",
    description: "Fold one party's tab into another's, keeping the higher minimum.",
    category: "tab",
    sensitive: true,
  },
  "tab:override-minimum": {
    label: "Override minimum spend",
    description: "Change a session's snapshotted minimum-spend commitment.",
    category: "tab",
    sensitive: true,
  },
  "cashout:close": {
    label: "Close cash-out",
    description: "Reconcile a shift or the venue's night by settlement method.",
    category: "operations",
    sensitive: true,
  },
  "audit:read": {
    label: "View audit trail",
    description: "See every sensitive action taken tonight, by whom and why.",
    category: "operations",
  },
  "door:count": {
    label: "Adjust occupancy",
    description: "Increment or decrement the live occupancy counter against legal capacity.",
    category: "door",
  },
  "door:admit": {
    label: "Admit arrivals",
    description: "Admit a walk-in, reservation or guestlist arrival at the door.",
    category: "door",
  },
  "door:admit-banned-override": {
    label: "Override a ban",
    description: "Admit a banned profile anyway. Always writes an audit entry.",
    category: "door",
    sensitive: true,
  },
  "door:id-check": {
    label: "Record ID checks",
    description: "Record that a guest's ID was checked and age verified at the door.",
    category: "door",
  },
  "waitlist:manage": {
    label: "Manage waitlist",
    description: "Add, notify and remove walk-in waitlist entries.",
    category: "door",
  },
  "incident:create": {
    label: "Report incidents",
    description: "File an incident report — anyone who sees trouble must be able to log it.",
    category: "incidents",
  },
  "incident:read-all": {
    label: "View all incidents",
    description: "See the venue-wide incident log, not just reports filed by this staff member.",
    category: "incidents",
  },
  "guest:read-profile": {
    label: "View guest profiles",
    description: "See a guest's visit history, VIP tier and flags at the door or on approval.",
    category: "guests",
  },
  "guest:edit-profile": {
    label: "Edit guest profiles",
    description: "Update a guest profile's details, tags and notes.",
    category: "guests",
    sensitive: true,
  },
  "guest:ban": {
    label: "Ban / unban guests",
    description: "Set or lift a guest profile's banned status.",
    category: "guests",
    sensitive: true,
  },
  "service:refuse": {
    label: "Refuse further service",
    description: "Block new orders for a session and log the reason as an incident.",
    category: "guests",
    sensitive: true,
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
    "tab:void", "tab:comp", "tab:discount", "tab:transfer", "tab:merge", "tab:override-minimum",
    "cashout:close", "audit:read",
    "door:count", "door:admit", "door:admit-banned-override", "door:id-check", "waitlist:manage",
    "incident:create", "incident:read-all",
    "guest:read-profile", "guest:edit-profile", "guest:ban", "service:refuse",
  ],
  host: [
    "order:accept", "order:claim", "order:release", "order:transition", "order:gift",
    "session:approve", "session:deny", "help:respond",
    "tab:void", "tab:comp", "tab:transfer", "tab:merge",
    "door:count", "door:admit", "door:id-check", "waitlist:manage",
    "incident:create", "guest:read-profile", "service:refuse",
  ],
  bartender: [
    "order:accept", "order:claim", "order:release", "order:transition",
    "help:respond",
    "tab:void", "cashout:close", // "own drawer" — closes their own till only
    "incident:create", "service:refuse",
  ],
  // Fulfillment only — can move orders forward but cannot accept new ones.
  runner: [
    "order:claim", "order:release", "order:transition",
    "help:respond",
    "incident:create",
  ],
  // Security — the door, incidents and flags-only guest lookups; no order/session/tab authority.
  security: [
    "help:respond",
    "door:count", "door:admit", "door:id-check",
    "incident:create", "incident:read-all",
    "guest:read-profile", // flags only — the UI hides visit/lifetime detail for this role
    "service:refuse",
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
