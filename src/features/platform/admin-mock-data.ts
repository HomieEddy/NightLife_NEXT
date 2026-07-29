import type { Lead, TelemetryLink, Tenant, TenantProvisioning } from "@/lib/types";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export const mockLeads: Lead[] = [
  {
    id: "lead-1", venueName: "Le Kung Fu", contactName: "Alexandre Dubois", email: "alex@lekungfu.ca", phone: "+1 514 555 1001", city: "Montréal",
    status: "new", source: "landing-page", dealValue: 2988,
    notes: "400-cap venue, wants QR ordering for VIP only.",
    activity: [{ id: "act-1a", at: daysAgo(1), text: "Submitted demo request via landing page" }],
    createdAt: daysAgo(1),
  },
  {
    id: "lead-2", venueName: "La Voûte", contactName: "Jade Okafor", email: "jade@lavoute.ca", phone: "+1 438 555 2002", city: "Montréal",
    status: "contacted", source: "referral", dealValue: 2988,
    notes: "Referred by Velvet Room. Interested in runner zone routing.",
    activity: [
      { id: "act-2a", at: daysAgo(3), text: "Referral intro from Velvet Room owner" },
      { id: "act-2b", at: daysAgo(2), text: "Intro call done — sending pricing deck" },
    ],
    createdAt: daysAgo(3),
  },
  {
    id: "lead-3", venueName: "Bar Ste-Catherine", contactName: "Émilie Garcia", email: "emilie@barstecatherine.ca", phone: "+1 514 555 3003", city: "Montréal",
    status: "demo", source: "landing-page", dealValue: 4200,
    notes: "Rooftop venue, terrace-heavy layout.",
    activity: [
      { id: "act-3a", at: daysAgo(6), text: "Landing page signup" },
      { id: "act-3b", at: daysAgo(4), text: "Qualification call — 21 tables, 3 zones" },
      { id: "act-3c", at: daysAgo(1), text: "Demo booked for Friday 15:00" },
    ],
    createdAt: daysAgo(6),
  },
  {
    id: "lead-4", venueName: "Le Rouge", contactName: "Pierre Dubois", email: "pierre@lerouge.ca", phone: "+1 450 555 4004", city: "Laval",
    status: "negotiating", source: "event", dealValue: 10788,
    notes: "Wants enterprise plan with multi-floor zones. Legal reviewing MSA.",
    activity: [
      { id: "act-4a", at: daysAgo(12), text: "Met at NightTech Expo Paris" },
      { id: "act-4b", at: daysAgo(8), text: "On-site walkthrough of both floors" },
      { id: "act-4c", at: daysAgo(3), text: "Sent enterprise MSA to legal" },
    ],
    createdAt: daysAgo(12),
  },
  {
    id: "lead-5", venueName: "Jardin Neon", contactName: "Lisa Chen", email: "lisa@jardinneon.ca", phone: "+1 514 555 5005", city: "Montréal",
    status: "won", source: "outbound", dealValue: 1788,
    notes: "Signed! Provisioning scheduled.",
    activity: [
      { id: "act-5a", at: daysAgo(18), text: "Cold outreach — replied same day" },
      { id: "act-5b", at: daysAgo(10), text: "Demo + trial started" },
      { id: "act-5c", at: daysAgo(4), text: "Contract signed — starter annual" },
    ],
    createdAt: daysAgo(18),
  },
  {
    id: "lead-6", venueName: "Plage Pulse", contactName: "Nikos Papadopoulos", email: "nikos@plagepulse.ca", phone: "+1 514 555 6006", city: "Montréal",
    status: "lost", source: "landing-page", dealValue: 2988,
    notes: "Went with competitor on pricing. Revisit next season.",
    activity: [
      { id: "act-6a", at: daysAgo(25), text: "Landing page signup" },
      { id: "act-6b", at: daysAgo(20), text: "Demo done — price sensitivity flagged" },
      { id: "act-6c", at: daysAgo(15), text: "Lost to competitor. Re-engage in April." },
    ],
    createdAt: daysAgo(25),
  },
];

const defaultProvisioning: TenantProvisioning = {
  timezone: "America/Toronto",
  currency: "CAD",
  serviceFees: [{ name: "Service", type: "percentage", value: 5 }],
  menuCategories: ["Bottles", "Cocktails", "Beer & Wine", "Soft drinks"],
};

export const mockTenants: Tenant[] = [
  {
    id: "ten-1", venueName: "Velvet Montréal", slug: "velvet-montreal", plan: "pro", status: "active", city: "Montréal", mrr: 1.99, createdAt: daysAgo(240),
    metrics: { orderCount30d: 2841, sessionCount30d: 963, tableCount: 23, staffCount: 14, zoneCount: 4, lastActivityAt: daysAgo(0) },
    staff: [
      { id: "ts-1a", name: "Marc Tremblay", role: "manager", email: "marc@velvetmontreal.ca" },
      { id: "ts-1b", name: "Sophie Bergeron", role: "host", email: "sophie@velvetmontreal.ca" },
      { id: "ts-1c", name: "Karim Haddad", role: "bartender", email: "karim@velvetmontreal.ca" },
      { id: "ts-1d", name: "Julie Gagnon", role: "runner", email: "julie@velvetmontreal.ca" },
      { id: "ts-1e", name: "Antoine Roy", role: "security", email: "antoine@velvetmontreal.ca" },
    ],
    provisioning: defaultProvisioning,
  },
  {
    id: "ten-2", venueName: "Le Kung Fu", slug: "le-kung-fu", plan: "starter", status: "trial", city: "Montréal", mrr: 0, createdAt: daysAgo(4),
    metrics: { orderCount30d: 118, sessionCount30d: 47, tableCount: 12, staffCount: 5, zoneCount: 2, lastActivityAt: daysAgo(1) },
    staff: [
      { id: "ts-2a", name: "Alexandre Dubois", role: "manager", email: "alex@lekungfu.ca" },
      { id: "ts-2b", name: "Mei Lin", role: "bartender", email: "mei@lekungfu.ca" },
      { id: "ts-2c", name: "Hugo Fortin", role: "runner", email: "hugo@lekungfu.ca" },
    ],
    provisioning: defaultProvisioning,
  },
  {
    id: "ten-3", venueName: "La Voûte", slug: "la-voute", plan: "enterprise", status: "active", city: "Montréal", mrr: 2.99, createdAt: daysAgo(180),
    metrics: { orderCount30d: 4310, sessionCount30d: 1522, tableCount: 41, staffCount: 27, zoneCount: 6, lastActivityAt: daysAgo(0) },
    staff: [
      { id: "ts-3a", name: "Jade Okafor", role: "manager", email: "jade@lavoute.ca" },
      { id: "ts-3b", name: "Étienne Morin", role: "host", email: "etienne@lavoute.ca" },
      { id: "ts-3c", name: "Camille Lefebvre", role: "bartender", email: "camille@lavoute.ca" },
      { id: "ts-3d", name: "Omar Benali", role: "runner", email: "omar@lavoute.ca" },
      { id: "ts-3e", name: "Nadia Petrov", role: "security", email: "nadia@lavoute.ca" },
      { id: "ts-3f", name: "Louis Caron", role: "bartender", email: "louis@lavoute.ca" },
    ],
    provisioning: {
      ...defaultProvisioning,
      serviceFees: [
        { name: "Service", type: "percentage", value: 7 },
        { name: "VIP table", type: "flat", value: 25 },
      ],
    },
  },
  {
    id: "ten-4", venueName: "Bar Ste-Catherine", slug: "bar-ste-catherine", plan: "pro", status: "active", city: "Montréal", mrr: 1.99, createdAt: daysAgo(120),
    metrics: { orderCount30d: 1675, sessionCount30d: 588, tableCount: 18, staffCount: 11, zoneCount: 3, lastActivityAt: daysAgo(0) },
    staff: [
      { id: "ts-4a", name: "Émilie Garcia", role: "manager", email: "emilie@barstecatherine.ca" },
      { id: "ts-4b", name: "Thomas Nguyen", role: "host", email: "thomas@barstecatherine.ca" },
      { id: "ts-4c", name: "Sarah Cohen", role: "bartender", email: "sarah@barstecatherine.ca" },
      { id: "ts-4d", name: "Maxime Pelletier", role: "runner", email: "maxime@barstecatherine.ca" },
    ],
    provisioning: defaultProvisioning,
  },
  {
    id: "ten-5", venueName: "Plage Pulse", slug: "plage-pulse", plan: "starter", status: "suspended", city: "Montréal", mrr: 0, createdAt: daysAgo(90),
    metrics: { orderCount30d: 0, sessionCount30d: 0, tableCount: 9, staffCount: 4, zoneCount: 2, lastActivityAt: daysAgo(31) },
    staff: [
      { id: "ts-5a", name: "Nikos Papadopoulos", role: "manager", email: "nikos@plagepulse.ca" },
      { id: "ts-5b", name: "Chloé Bouchard", role: "bartender", email: "chloe@plagepulse.ca" },
    ],
    provisioning: defaultProvisioning,
  },
];

export const mockTelemetryLinks: TelemetryLink[] = [
  { id: "tel-1", name: "Sentry — errors", url: "https://sentry.io/organizations/nightlifenext", category: "monitoring" },
  { id: "tel-2", name: "Grafana — API dashboards", url: "https://grafana.nightlifenext.app", category: "monitoring" },
  { id: "tel-3", name: "Better Stack — logs", url: "https://logs.betterstack.com", category: "logs" },
  { id: "tel-4", name: "Vercel — deployments", url: "https://vercel.com/nightlifenext", category: "infra" },
];
