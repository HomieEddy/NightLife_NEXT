/** One-segment SMS templates (≤160 chars where possible). Venue name leads every message. */

// ── English ────────────────────────────────────────────────────

export function reservationPinSms(venueName: string, pin: string): string {
  return `${venueName}: Your reservation PIN is ${pin}. Show this at your table to access the QR ordering.`;
}

export function reservationConfirmationSms(venueName: string, guestName: string, date: string): string {
  return `${venueName}: Hi ${guestName}, your reservation for ${date} is confirmed.`;
}

export function reservationReminderSms(venueName: string, guestName: string, time: string): string {
  return `${venueName}: Reminder — your table is held until ${time}.`;
}

// ── French (Québécois) ─────────────────────────────────────────

export function reservationPinSmsFr(venueName: string, pin: string): string {
  return `${venueName}: Votre NIP de réservation est ${pin}. Présentez-le à votre table pour accéder au menu QR.`;
}

export function reservationConfirmationSmsFr(venueName: string, guestName: string, date: string): string {
  return `${venueName}: Bonjour ${guestName}, votre réservation du ${date} est confirmée.`;
}

export function reservationReminderSmsFr(venueName: string, guestName: string, time: string): string {
  return `${venueName}: Rappel — votre table est réservée jusqu'à ${time}.`;
}
