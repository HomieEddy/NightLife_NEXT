import type { IncidentTemplate } from "@/lib/types";

export const mockIncidentTemplates: IncidentTemplate[] = [
  {
    id: "itpl-1",
    venueId: "venue-1",
    type: "ejection",
    severity: "medium",
    narrativeTemplate:
      "On {date} at approximately {time}, {guestName} was ejected from {zoneName} by {staffName}.\n\nReason: {reason}\n\nGuest behavior: {behavior}\n\nForce used: {forceUsed}\n\nPolice called: {policeCalled}",
    actionsTakenTemplate:
      "Guest was escorted to exit by {staffName}.{policeAction} Incident logged and security report filed.",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "itpl-2",
    venueId: "venue-1",
    type: "medical",
    severity: "high",
    narrativeTemplate:
      "On {date} at approximately {time}, {guestName} ({partySize} pax, at {zoneName}) experienced a medical incident.\n\nSymptoms reported: {symptoms}\n\nFirst aid provided by: {firstAider}\n\nAmbulance called: {ambulanceCalled}\n\nTransported to: {hospital}",
    actionsTakenTemplate:
      "{firstAider} provided first aid at scene. {ambulanceAction} Manager {managerName} notified. Incident report filed.{transportNote}",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "itpl-3",
    venueId: "venue-1",
    type: "altercation",
    severity: "high",
    narrativeTemplate:
      "On {date} at approximately {time}, an altercation involving {partyCount} individuals occurred in {zoneName}.\n\nParties involved: {parties}\n\nDescription: {description}\n\nWeapons involved: {weapons}\n\nPolice called: {policeCalled}\n\nInjuries sustained: {injuries}",
    actionsTakenTemplate:
      "Security {securityName} responded and separated parties. {policeAction} Parties were {outcome}. CCTV reviewed. Incident report filed.{witnessNote}",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "itpl-4",
    venueId: "venue-1",
    type: "property-damage",
    severity: "low",
    narrativeTemplate:
      "On {date} at approximately {time}, property damage was reported in {zoneName} by {reporter}.\n\nDamaged item: {item}\n\nEstimated cost: ${cost}\n\nCause: {cause}\n\nResponsible party identified: {responsible}\n\nCCTV timestamp: {cctvTimestamp}",
    actionsTakenTemplate:
      "Area was secured by {staffName}. {responsibleAction} Photos taken. Maintenance notified. Incident report filed.",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "itpl-5",
    venueId: "venue-1",
    type: "refused-entry",
    severity: "low",
    narrativeTemplate:
      "On {date} at approximately {time}, {guestName} ({partySize} pax) was refused entry by {staffName} at {zoneName}.\n\nReason for refusal: {reason}\n\nGuest reaction: {reaction}\n\nGuest identification: {idInfo}\n\nBanned status: {banned}",
    actionsTakenTemplate:
      "{staffName} refused entry and explained reason. {banAction} Incident logged. Door supervisor {supervisor} notified.",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];
