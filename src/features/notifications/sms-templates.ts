/** One-segment SMS templates (≤160 chars where possible). Venue name leads every message. */

export function reservationPinSms(venueName: string, pin: string): string {
  return `${venueName}: Your reservation PIN is ${pin}. Show this at your table to access the QR ordering.`;
}

export function reservationConfirmationSms(venueName: string, guestName: string, date: string): string {
  return `${venueName}: Hi ${guestName}, your reservation for ${date} is confirmed.`;
}

export function reservationReminderSms(venueName: string, guestName: string, time: string): string {
  return `${venueName}: Reminder — your table is held until ${time}.`;
}
