import type { StaffMember, StaffShift, ChatMessage } from "@/lib/types";

export const mockStaff: StaffMember[] = [
  { id: "st-amara", venueId: "venue-1", name: "Amara Bélanger", role: "manager", phone: "+1 514 555 0101", email: "amara@velvetmtl.club", accountStatus: "active", assignedZoneIds: [], isOnShift: true, avatarInitials: "AB" },
  { id: "st-lucas", venueId: "venue-1", name: "Lucas Gagné", role: "host", phone: "+1 514 555 0102", email: "lucas@velvetmtl.club", accountStatus: "active", assignedZoneIds: ["zone-vip"], isOnShift: true, avatarInitials: "LG" },
  { id: "st-sofia", venueId: "venue-1", name: "Sofia Lévesque", role: "bartender", phone: "+1 514 555 0103", email: "sofia@velvetmtl.club", accountStatus: "active", assignedZoneIds: ["zone-bar"], isOnShift: true, avatarInitials: "SL" },
  { id: "st-theo", venueId: "venue-1", name: "Théo Tremblay", role: "bartender", phone: "+1 514 555 0104", email: "theo@velvetmtl.club", accountStatus: "active", assignedZoneIds: ["zone-dance"], isOnShift: true, avatarInitials: "TT" },
  { id: "st-nina", venueId: "venue-1", name: "Nina Côté", role: "runner", phone: "+1 514 555 0105", email: "nina@velvetmtl.club", accountStatus: "active", assignedZoneIds: ["zone-vip", "zone-terrace"], isOnShift: true, avatarInitials: "NC" },
  { id: "st-karim", venueId: "venue-1", name: "Karim Ouellet", role: "runner", phone: "+1 514 555 0106", email: "karim@velvetmtl.club", accountStatus: "suspended", assignedZoneIds: ["zone-dance", "zone-bar"], isOnShift: false, avatarInitials: "KO" },
  { id: "st-viktor", venueId: "venue-1", name: "Viktor Michaud", role: "security", phone: "+1 514 555 0107", email: "viktor@velvetmtl.club", accountStatus: "active", assignedZoneIds: ["zone-vip"], isOnShift: true, avatarInitials: "VM" },
  { id: "st-emma", venueId: "venue-1", name: "Emma Bergeron", role: "host", phone: "+1 514 555 0108", email: "emma@velvetmtl.club", accountStatus: "invited", assignedZoneIds: ["zone-terrace"], isOnShift: false, avatarInitials: "EB" },
  { id: "st-julien", venueId: "venue-1", name: "Julien Dubois", role: "promoter", phone: "+1 514 555 0109", email: "julien@velvetmtl.club", accountStatus: "active", assignedZoneIds: ["zone-vip", "zone-terrace"], isOnShift: true, avatarInitials: "JD" },
  { id: "st-chloe", venueId: "venue-1", name: "Chloé Mercier", role: "promoter", phone: "+1 514 555 0110", email: "chloe@velvetmtl.club", accountStatus: "active", assignedZoneIds: ["zone-vip", "zone-dance"], isOnShift: true, avatarInitials: "CM" },
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
  { id: "cm-1", channel: "floor", authorId: "st-lucas", authorName: "Lucas Gagné", authorRole: "host", body: "VIP-03 party of 10 arriving in 15, booth is set", sentAt: minsAgo(42) },
  { id: "cm-2", channel: "floor", authorId: "st-nina", authorName: "Nina Côté", authorRole: "runner", body: "Copy, I'll run the welcome bottles", sentAt: minsAgo(40) },
  { id: "cm-3", channel: "bar", authorId: "st-sofia", authorName: "Sofia Lévesque", authorRole: "bartender", body: "86 Ace of Spades gold — last bottle just sold", sentAt: minsAgo(35) },
  { id: "cm-4", channel: "floor", authorId: "st-amara", authorName: "Amara Bélanger", authorRole: "manager", body: "Great pace tonight team. Watch terrace, it's filling up", sentAt: minsAgo(28) },
  { id: "cm-5", channel: "floor", authorId: "st-amara", authorName: "Amara Bélanger", authorRole: "manager", body: "Lucas, comp the welcome bottle for VIP-03 — birthday table", sentAt: minsAgo(26) },
  { id: "cm-6", channel: "floor", authorId: "st-lucas", authorName: "Lucas Gagné", authorRole: "host", body: "Copy that. Adding a sparkler parade too?", sentAt: minsAgo(25) },
  { id: "cm-7", channel: "floor", authorId: "st-amara", authorName: "Amara Bélanger", authorRole: "manager", body: "Good call. Make it happen.", sentAt: minsAgo(24) },
  { id: "cm-8", channel: "security", authorId: "st-viktor", authorName: "Viktor Michaud", authorRole: "security", body: "All clear on mezzanine. Rotating to main floor", sentAt: minsAgo(20) },
  { id: "cm-9", channel: "security", authorId: "st-amara", authorName: "Amara Bélanger", authorRole: "manager", body: "Copy. Keep an eye on the terrace exit too — heard it's busy out there.", sentAt: minsAgo(19) },
  { id: "cm-10", channel: "bar", authorId: "st-sofia", authorName: "Sofia Lévesque", authorRole: "bartender", body: "86 Ace of Spades gold — last bottle just sold", sentAt: minsAgo(17) },
  { id: "cm-11", channel: "bar", authorId: "st-amara", authorName: "Amara Bélanger", authorRole: "manager", body: "Put a restock request in for Monday. We'll need 6 minimum for Saturday.", sentAt: minsAgo(16) },
  { id: "cm-12", channel: "bar", authorId: "st-sofia", authorName: "Sofia Lévesque", authorRole: "bartender", body: "Already done. Also running low on limes — sending Théo to storage.", sentAt: minsAgo(12) },
  { id: "cm-13", channel: "floor", authorId: "st-lucas", authorName: "Lucas Gagné", authorRole: "host", body: "MF-05 asking about happy hour — ends 23:30, remind guests", sentAt: minsAgo(6) },
  { id: "cm-14", channel: "floor", authorId: "st-amara", authorName: "Amara Bélanger", authorRole: "manager", body: "Let them know we'll honor it for one more round since they arrived late.", sentAt: minsAgo(5) },
];
