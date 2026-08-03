import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { locales, defaultLocale, cookieName } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  // No [locale] routing segment — resolve from cookie, ?lang= param, or default.
  // requestLocale is undefined when no routing integration is configured.

  let locale: string = defaultLocale;

  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(cookieName)?.value;
    if (cookieVal && locales.includes(cookieVal as typeof defaultLocale)) {
      locale = cookieVal;
    }
  } catch {
    // cookies() throws during static generation — fall back to default
  }

  // ?lang= override on embeds takes priority over cookie
  const resolved = await requestLocale;
  if (resolved && locales.includes(resolved as typeof defaultLocale)) {
    locale = resolved;
  }

  // First-visit default: the browser's language preference (no cookie yet).
  if (locale === defaultLocale) {
    try {
      const accept = (await headers()).get("accept-language") ?? "";
      const first = accept.split(",")[0]?.trim().toLowerCase();
      if (first?.startsWith("fr")) locale = "fr";
    } catch {
      // headers() throws during static generation — keep the default
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
