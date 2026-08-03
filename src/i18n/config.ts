export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const cookieName = "nln-locale";

const DAYS_MS = 365 * 24 * 60 * 60 * 1000;

/** Persist the locale cookie (client-side). Server responses set it via NextResponse.cookies. */
export function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + DAYS_MS).toUTCString();
  document.cookie = `${cookieName}=${locale};expires=${expires};path=/;SameSite=Lax`;
}

/** Read the locale cookie (client-side). */
export function getLocaleCookie(): Locale {
  if (typeof document === "undefined") return defaultLocale;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`)
  );
  return match?.[1] === "fr" ? "fr" : defaultLocale;
}
