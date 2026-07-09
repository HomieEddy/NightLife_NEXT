import type { StaffMember, StaffShift, ChatMessage } from "@/lib/types";

export const mockStaff: StaffMember[] = [
  { id: "st-amara", venueId: "venue-1", name: "Amara Diallo", role: "manager", phone: "+33 6 12 34 56 01", email: "amara@luxenoir.club", accountStatus: "active", assignedZoneIds: [], isOnShift: true, avatarInitials: "AD" },
  { id: "st-lucas", venueId: "venue-1", name: "Lucas Moreau", role: "host", phone: "+33 6 12 34 56 02", email: "lucas@luxenoir.club", accountStatus: "active", assignedZoneIds: ["zone-vip"], isOnShift: true, avatarInitials: "LM" },
  { id: "st-sofia", venueId: "venue-1", name: "Sofia Rossi", role: "bartender", phone: "+33 6 12 34 56 03", email: "sofia@luxenoir.club", accountStatus: "active", assignedZoneIds: ["zone-bar"], isOnShift: true, avatarInitials: "SR" },
  { id: "st-theo", venueId: "venue-1", name: "Théo Lambert", role: "bartender", phone: "+33 6 12 34 56 04", email: "theo@luxenoir.club", accountStatus: "active", assignedZoneIds: ["zone-dance"], isOnShift: true, avatarInitials: "TL" },
  { id: "st-nina", venueId: "venue-1", name: "Nina Kovač", role: "runner", phone: "+33 6 12 34 56 05", email: "nina@luxenoir.club", accountStatus: "active", assignedZoneIds: ["zone-vip", "zone-terrace"], isOnShift: true, avatarInitials: "NK" },
  { id: "st-karim", venueId: "venue-1", name: "Karim Haddad", role: "runner", phone: "+33 6 12 34 56 06", email: "karim@luxenoir.club", accountStatus: "suspended", assignedZoneIds: ["zone-dance", "zone-bar"], isOnShift: false, avatarInitials: "KH" },
  { id: "st-viktor", venueId: "venue-1", name: "Viktor Petrov", role: "security", phone: "+33 6 12 34 56 07", email: "viktor@luxenoir.club", accountStatus: "active", assignedZoneIds: ["zone-vip"], isOnShift: true, avatarInitials: "VP" },
  { id: "st-emma", venueId: "venue-1", name: "Emma Laurent", role: "host", phone: "+33 6 12 34 56 08", email: "emma@luxenoir.club", accountStatus: "invited", assignedZoneIds: ["zone-terrace"], isOnShift: false, avatarInitials: "EL" },
];

export const mockShifts: StaffShift[] = [
  { id: "sh-1", staffId: "st-lucas", dayOfWeek: 4, startTime: "21:30", endTime: "04:00", zoneId: "zone-vip" },
  { id: "sh-2", staffId: "st-lucas", dayOfWeek: 5, startTime: "21:30", endTime: "06:00", zoneId: "zone-vip" },
  { id: "sh-3", staffId: "st-sofia", dayOfWeek: 5, startTime: "22:00", endTime: "06:00", zoneId: "zone-bar" },
  { id: "sh-4", staffId: "st-sofia", dayOfWeek: 6, startTime: "22:00", endTime: "06:00", zoneId: "zone-bar" },
  { id: "sh-5", staffId: "st-theo", dayOfWeek: 6, startTime: "22:00", endTime: "06:00", zoneId: "zone-dance" },
  { id: "sh-6", staffId: "st-nina", dayOfWeek: 4, startTime: "22:00", endTime: "04:00", zoneId: "zone-vip" },
  { id: "sh-7", staffId: "st-nina", dayOfWeek: 5, startTime: "22:00", endTime: "06:00", zoneId: "zone-terrace" },
  { id: "sh-8", staffId: "st-nina", dayOfWeek: 6, startTime: "22:00", endTime: "06:00", zoneId: "zone-terrace" },
  { id: "sh-9", staffId: "st-emma", dayOfWeek: 6, startTime: "21:00", endTime: "05:00", zoneId: "zone-terrace" },
  { id: "sh-10", staffId: "st-karim", dayOfWeek: 5, startTime: "23:00", endTime: "06:00", zoneId: "zone-dance" },
];

/** The staff member the /staff panel simulates being logged in as. */
export const CURRENT_STAFF_ID = "st-nina";

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const mockChatMessages: ChatMessage[] = [
  { id: "cm-1", channel: "floor", authorId: "st-lucas", authorName: "Lucas Moreau", authorRole: "host", body: "VIP-03 party of 10 arriving in 15, booth is set", sentAt: minsAgo(42) },
  { id: "cm-2", channel: "floor", authorId: "st-nina", authorName: "Nina Kovač", authorRole: "runner", body: "Copy, I'll run the welcome bottles", sentAt: minsAgo(40) },
  { id: "cm-3", channel: "bar", authorId: "st-sofia", authorName: "Sofia Rossi", authorRole: "bartender", body: "86 Ace of Spades gold — last bottle just sold", sentAt: minsAgo(35) },
  { id: "cm-4", channel: "floor", authorId: "st-amara", authorName: "Amara Diallo", authorRole: "manager", body: "Great pace tonight team. Watch terrace, it's filling up", sentAt: minsAgo(28) },
  { id: "cm-5", channel: "security", authorId: "st-viktor", authorName: "Viktor Petrov", authorRole: "security", body: "All clear on mezzanine. Rotating to main floor", sentAt: minsAgo(20) },
  { id: "cm-6", channel: "bar", authorId: "st-theo", authorName: "Théo Lambert", authorRole: "bartender", body: "Running low on limes, sending someone to storage", sentAt: minsAgo(12) },
  { id: "cm-7", channel: "floor", authorId: "st-lucas", authorName: "Lucas Moreau", authorRole: "host", body: "MF-05 asking about happy hour — ends 23:30, remind guests", sentAt: minsAgo(6) },
];
