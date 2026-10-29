"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/features/shared/utils";
import { setLocaleCookie, type Locale } from "@/i18n/config";

const opposite: Record<Locale, Locale> = { en: "fr", fr: "en" };
const label: Record<Locale, string> = { en: "FR", fr: "EN" };

/**
 * Ghost icon button showing target locale ("FR" when English, "EN" when French).
 * The label follows the locale the page actually rendered with (next-intl), not
 * the cookie, so a stale cookie can never make the button offer a no-op switch.
 * Sets `nln-locale` cookie, then soft-refreshes server components so they pick up
 * the new locale without losing demo mock state (§3.5 — a hard reload would reset
 * the sandbox).
 */
export function LocaleToggle({ className }: { className?: string }) {
  const router = useRouter();
  const current = useLocale() === "fr" ? "fr" : "en";
  const target = opposite[current];

  function handleToggle() {
    setLocaleCookie(target);
    router.refresh();
  }

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
