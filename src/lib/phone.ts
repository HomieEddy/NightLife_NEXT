/**
 * E.164 phone normalization — Canadian/US NANP only.
 * No libphonenumber dependency; earned when a non-NANP market exists.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 12 && digits.startsWith("+1") && digits.length <= 15) return digits;
  return null;
}

export function formatPhone(e164: string): string {
  if (e164.startsWith("+1") && e164.length === 12) {
    return `(${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`;
  }
  return e164;
}
