const currencyLocale: Record<string, string> = {
  CAD: "en-CA",
  USD: "en-US",
  EUR: "en-DE",
  GBP: "en-GB",
};

/** Map currency + locale → Intl locale tag. French → fr-CA for CAD, fr-FR otherwise. */
function currencyTag(currency: string, locale: string): string {
  if (locale === "fr") {
    return currency === "CAD" ? "fr-CA" : "fr-FR";
  }
  return currencyLocale[currency] ?? "en-CA";
}

/** Date/time locale tag: fr → fr-CA, en → en-GB. */
export function dateLocale(locale: string): string {
  return locale === "fr" ? "fr-CA" : "en-GB";
}

function formatterFor(currency: string, fractionDigits: number, locale: string) {
  return new Intl.NumberFormat(currencyTag(currency, locale), {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Whole amounts render as "$18" (en) or "18 $" (fr), fractional as "$20.70" / "20,70 $". */
export function formatMoney(amount: number, currency = "CAD", locale = "en"): string {
  return Number.isInteger(amount)
    ? formatterFor(currency, 0, locale).format(amount)
    : formatterFor(currency, 2, locale).format(amount);
}

/** Ratio → whole percent: 0.125 → "13%". */
export function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function timeAgo(iso: string, locale = "en"): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return locale === "fr" ? "à l'instant" : "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === "fr" ? `il y a ${minutes} min` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === "fr" ? `il y a ${hours} h` : `${hours}h ago`;
  return locale === "fr" ? `il y a ${Math.floor(hours / 24)} j` : `${Math.floor(hours / 24)}d ago`;
}

export function formatTime(iso: string, locale = "en"): string {
  return new Date(iso).toLocaleTimeString(dateLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string, locale = "en"): string {
  return new Date(iso).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "short", year: "numeric" });
}
