import type { StaffRole } from "@/lib/types";

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
  | "lastcall:start"             // start last-call sequence (stop new orders, broadcast)
  | "broadcast:send"             // send a broadcast message to all staff channels
  | "incident:create"             // file an incident report
  | "incident:read-all"           // view the venue-wide incident log
  | "guest:read-profile"          // view a guest profile (security sees flags only)
  | "guest:edit-profile"          // edit a guest profile's details/tags
  | "guest:ban"                   // set/lift a guest's banned status
  | "service:refuse"             // refuse further service to a session
  | "emergency:evacuate"         // trigger emergency evacuation (zero occupancy, broadcast) — manager + security-lead
  | "emergency:resume"           // resume normal operations after an evacuation — manager only
  | "door:admit-capacity-override" // bypass the legal-capacity check at the door (always audited)
  | "incident:mark-reportable"    // mark an incident as reportable to a regulatory authority
  | "certification:manage"        // create, edit, verify and revoke staff certifications
  | "time:clock-self"            // clock in/out for yourself
  | "time:edit-others"           // correct another staff member's time entry
  | "schedule:publish"           // publish a generated week to the crew
  | "schedule:request-swap"      // offer or claim a shift swap
  | "schedule:request-time-off"  // request time off
  | "schedule:approve-swap"      // approve or deny a swap request
  | "schedule:approve-time-off"  // approve or deny a time-off request
  | "tips:close-distribution"    // freeze a night's tip pool distribution
  | "tips:read-own"              // see your own tip share
  | "commission:approve"        // approve a promoter's commission statement
  | "purchasing:draft"           // create and edit draft purchase orders
  | "purchasing:submit"          // submit a PO to a supplier
  | "purchasing:receive"         // receive goods against a PO (writes restock movements)
  | "stocktake:count"            // count items on a stocktake
  | "stocktake:commit"           // commit a stocktake (writes adjustment movements)
  | "inventory:waste"            // record waste/spillage
  | "inventory:86"              // manually 86 an item
  | "cost:read";                // view supplier pricing and margin data

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
  "lastcall:start": {
    label: "Start last call",
    description: "Stop new orders and broadcast last call to all channels.",
    category: "orders",
    sensitive: true,
  },
  "broadcast:send": {
    label: "Send broadcast",
    description: "Send a message to floor, bar and security channels.",
    category: "orders",
    sensitive: true,
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
  "emergency:evacuate": {
    label: "Emergency evacuation",
    description: "Trigger emergency evacuation — zeros occupancy, broadcasts to all channels, and disables admissions.",
    category: "door",
    sensitive: true,
  },
  "emergency:resume": {
    label: "Resume normal operations",
    description: "End an evacuation and restore normal admission operations.",
    category: "door",
    sensitive: true,
  },
  "door:admit-capacity-override": {
    label: "Override capacity",
    description: "Bypass the legal-capacity check — always writes an audit entry.",
    category: "door",
    sensitive: true,
  },
  "incident:mark-reportable": {
    label: "Mark incident reportable",
    description: "Flag an incident as requiring regulatory reporting and set a deadline.",
    category: "incidents",
    sensitive: true,
  },
  "certification:manage": {
    label: "Manage certifications",
    description: "Create, edit, verify and revoke staff certifications (Smart Serve, First Aid, etc.).",
    category: "operations",
    sensitive: true,
  },
  "time:clock-self": {
    label: "Clock in / out",
    description: "Record your own clock-in, breaks and clock-out.",
    category: "operations",
  },
  "time:edit-others": {
    label: "Edit time entries",
    description: "Correct or supersede another staff member's clock records with a reason.",
    category: "operations",
    sensitive: true,
  },
  "schedule:publish": {
    label: "Publish schedule",
    description: "Generate and publish a week's shifts from templates to the entire crew.",
    category: "operations",
    sensitive: true,
  },
  "schedule:request-swap": {
    label: "Request shift swap",
    description: "Offer a shift to swap or claim an open swap offer.",
    category: "operations",
  },
  "schedule:request-time-off": {
    label: "Request time off",
    description: "Submit a time-off request for manager approval.",
    category: "operations",
  },
  "schedule:approve-swap": {
    label: "Approve shift swaps",
    description: "Approve or deny a shift-swap request.",
    category: "operations",
    sensitive: true,
  },
  "schedule:approve-time-off": {
    label: "Approve time off",
    description: "Approve or deny a time-off request.",
    category: "operations",
    sensitive: true,
  },
  "tips:close-distribution": {
    label: "Close tip distribution",
    description: "Freeze a night's tip pool split — writes an audit entry and the shares become visible to staff.",
    category: "operations",
    sensitive: true,
  },
  "tips:read-own": {
    label: "View own tips",
    description: "See your own tip share after the distribution is closed.",
    category: "operations",
  },
  "commission:approve": {
    label: "Approve commission",
    description: "Approve a promoter's commission statement — writes an audit entry.",
    category: "operations",
    sensitive: true,
  },
  "purchasing:draft": {
    label: "Draft purchase orders",
    description: "Create and edit draft purchase orders from suggested or manual inputs.",
    category: "operations",
  },
  "purchasing:submit": {
    label: "Submit purchase orders",
    description: "Submit a finalised purchase order to a supplier.",
    category: "operations",
    sensitive: true,
  },
  "purchasing:receive": {
    label: "Receive purchase orders",
    description: "Record goods received against a PO — writes restock movements and recomputes average cost.",
    category: "operations",
    sensitive: true,
  },
  "stocktake:count": {
    label: "Count stocktake items",
    description: "Record counted quantities on an open stocktake session.",
    category: "operations",
  },
  "stocktake:commit": {
    label: "Commit stocktake",
    description: "Finalise a stocktake — writes one adjustment movement per variance line.",
    category: "operations",
    sensitive: true,
  },
  "inventory:waste": {
    label: "Record waste",
    description: "Log a spill, breakage or other waste event against an inventory item.",
    category: "operations",
  },
  "inventory:86": {
    label: "86 an item",
    description: "Manually mark an item as unavailable with a reason, distinct from a natural sell-out.",
    category: "operations",
  },
  "cost:read": {
    label: "View cost data",
    description: "See supplier pricing, margin reports and profitability analytics.",
    category: "operations",
  },
};

// ---------- Permission matrix ----------

/**
 * Serialisable capability record — suitable for DB storage and API transport.
 * Use arrays (not Sets) so values round-trip through JSON without loss.
 *
 * Backed by the venue_role_permissions table.
 * Each row stores (venueId, role, actions[]) and is merged over DEFAULT_ROLE_PERMISSIONS
 * so tenants only need to record the delta from the defaults.
 */
export type RolePermissions = Record<StaffRole, StaffAction[]>;

/** Baseline capabilities shipped with the app. Tenants may override per-venue. */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  manager: [
    "order:accept", "order:claim", "order:release", "order:transition", "order:gift",
    "session:approve", "session:deny", "help:respond",
    "lastcall:start", "broadcast:send",
    "tab:void", "tab:comp", "tab:discount", "tab:transfer", "tab:merge", "tab:override-minimum",
    "cashout:close", "audit:read",
    "door:count", "door:admit", "door:admit-banned-override", "door:id-check", "waitlist:manage",
    "door:admit-capacity-override",
    "incident:create", "incident:read-all", "incident:mark-reportable",
    "guest:read-profile", "guest:edit-profile", "guest:ban", "service:refuse",
    "emergency:evacuate", "emergency:resume",
    "certification:manage",
    "time:clock-self", "time:edit-others", "schedule:publish",
    "schedule:request-swap", "schedule:request-time-off",
    "schedule:approve-swap", "schedule:approve-time-off",
    "tips:close-distribution", "tips:read-own",
    "commission:approve",
    "purchasing:draft", "purchasing:submit", "purchasing:receive",
    "stocktake:count", "stocktake:commit",
    "inventory:waste", "inventory:86", "cost:read",
  ],
  host: [
    "order:accept", "order:claim", "order:release", "order:transition", "order:gift",
    "session:approve", "session:deny", "help:respond",
    "tab:void", "tab:comp", "tab:transfer", "tab:merge",
    "door:count", "door:admit", "door:id-check", "waitlist:manage",
    "incident:create", "guest:read-profile", "service:refuse",
    "time:clock-self", "schedule:request-swap", "schedule:request-time-off", "tips:read-own",
    "stocktake:count", "inventory:waste", "inventory:86",
  ],
  bartender: [
    "order:accept", "order:claim", "order:release", "order:transition",
    "help:respond",
    "tab:void", "cashout:close",
    "incident:create", "service:refuse",
    "time:clock-self", "schedule:request-swap", "schedule:request-time-off", "tips:read-own",
    "purchasing:draft", "stocktake:count", "inventory:waste", "inventory:86",
  ],
  // Fulfillment only — can move orders forward but cannot accept new ones.
  runner: [
    "order:claim", "order:release", "order:transition",
    "help:respond",
    "incident:create",
    "time:clock-self", "schedule:request-swap", "schedule:request-time-off", "tips:read-own",
  ],
  // Security — the door, incidents and flags-only guest lookups; no order/session/tab authority.
  security: [
    "help:respond",
    "door:count", "door:admit", "door:id-check",
    "incident:create", "incident:read-all", "incident:mark-reportable",
    "guest:read-profile", // flags only — the UI hides visit/lifetime detail for this role
    "service:refuse",
    "emergency:evacuate", // security lead in real life, but in the demo matrix security can evacuate
    "time:clock-self", "schedule:request-swap", "schedule:request-time-off", "tips:read-own",
  ],
  promoter: [
    "reservation:create-own", "reservation:edit-own",
    "reservation:cancel-own", "reservation:confirm-own",
    "time:clock-self", "schedule:request-swap", "schedule:request-time-off", "tips:read-own",
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
