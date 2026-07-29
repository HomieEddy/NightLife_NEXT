const currencyLocale: Record<string, string> = {
  CAD: "en-CA",
  USD: "en-US",
  EUR: "en-DE",
  GBP: "en-GB",
};

function formatterFor(currency: string, fractionDigits: number) {
  return new Intl.NumberFormat(currencyLocale[currency] ?? "en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Whole amounts render as "$18", fractional ones as "$20.70". */
export function formatMoney(amount: number, currency = "CAD"): string {
  return Number.isInteger(amount)
    ? formatterFor(currency, 0).format(amount)
    : formatterFor(currency, 2).format(amount);
}

/** Ratio → whole percent: 0.125 → "13%". */
export function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
