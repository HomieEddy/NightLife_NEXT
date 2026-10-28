/**
 * Venue-default language normalization. A venue's `guestLocale` can be a
 * string, null, or unset — but the product only speaks en/fr, so the whole
 * vocabulary reduces to "fr → fr, everything else → en". One definition so
 * a fallback change (e.g. adding "es") is a one-touch edit, not a six-file
 * audit.
 */
export function normalizeVenueLocale(raw: string | null | undefined): "en" | "fr" {
  return raw === "fr" ? "fr" : "en";
}
