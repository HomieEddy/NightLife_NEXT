"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/features/shared/utils";
import { cookieName, defaultLocale, type Locale } from "@/i18n/config";

const opposite: Record<Locale, Locale> = { en: "fr", fr: "en" };
const label: Record<Locale, string> = { en: "FR", fr: "EN" };

function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const days = 365;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${cookieName}=${locale};expires=${expires};path=/;SameSite=Lax`;
}

function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return defaultLocale;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`)
  );
  return match?.[1] === "fr" ? "fr" : defaultLocale;
}

/**
 * Ghost icon button showing target locale ("FR" when English, "EN" when French).
 * Mirrors ThemeToggle's mounted-guard pattern. Sets `nln-locale` cookie, then
 * soft-reloads so server components pick up the new locale without losing demo state.
 */
export function LocaleToggle({ className }: { className?: string }) {
  const intlLocale = useLocale();
  const [mounted, setMounted] = useState(false);
  const current =
    mounted && intlLocale === "fr" ? "fr" : (getLocaleFromCookie());
  const target = opposite[current];

  useEffect(() => setMounted(true), []);

  function handleToggle() {
    setLocaleCookie(target);
    if (typeof location !== "undefined") {
      // Soft navigation — preserve demo mock state (§3.5)
      location.reload();
    }
  }

  if (!mounted) return <div className={cn("size-9", className)} aria-hidden />;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={target === "fr" ? "Switch to French" : "Switch to English"}
      onClick={handleToggle}
    >
      <span className="text-xs font-bold tabular-nums">{label[target]}</span>
    </Button>
  );
}
