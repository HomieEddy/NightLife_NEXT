import type { Lead, Tenant } from "@/lib/types";

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

export const mockTenants: Tenant[] = [
  { id: "ten-1", venueName: "Velvet Montréal", slug: "velvet-montreal", plan: "pro", status: "active", city: "Montréal", tableCount: 23, monthlyRevenue: 1.99, createdAt: daysAgo(240) },
  { id: "ten-2", venueName: "Le Kung Fu", slug: "le-kung-fu", plan: "starter", status: "trial", city: "Montréal", tableCount: 12, monthlyRevenue: 0, createdAt: daysAgo(4) },
  { id: "ten-3", venueName: "La Voûte", slug: "la-voute", plan: "enterprise", status: "active", city: "Montréal", tableCount: 41, monthlyRevenue: 2.99, createdAt: daysAgo(180) },
  { id: "ten-4", venueName: "Bar Ste-Catherine", slug: "bar-ste-catherine", plan: "pro", status: "active", city: "Montréal", tableCount: 18, monthlyRevenue: 1.99, createdAt: daysAgo(120) },
  { id: "ten-5", venueName: "Plage Pulse", slug: "plage-pulse", plan: "starter", status: "suspended", city: "Montréal", tableCount: 9, monthlyRevenue: 0.99, createdAt: daysAgo(90) },
];
