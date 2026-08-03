"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cookieName, defaultLocale, type Locale } from "@/i18n/config";

function setLangCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const days = 365;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${cookieName}=${locale};expires=${expires};path=/;SameSite=Lax`;
}

/**
 * Reads `?lang=` from URL and sets the nln-locale cookie on first paint.
 * Used in /r/[slug] and /e/[slug] embeds so a venue's French website embedding
 * `?lang=fr` gets a French-rendered page from the first paint.
 */
function LangParamHandlerInner() {
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang");

  useEffect(() => {
    if (lang === "fr" || lang === "en") {
      setLangCookie(lang as Locale);
    }
  }, [lang]);

  return null;
}

export function LangParamHandler() {
  return (
    <Suspense>
      <LangParamHandlerInner />
    </Suspense>
  );
}
