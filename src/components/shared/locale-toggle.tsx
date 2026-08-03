"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/features/shared/utils";
import {
  defaultLocale,
  getLocaleCookie,
  setLocaleCookie,
  type Locale,
} from "@/i18n/config";

const opposite: Record<Locale, Locale> = { en: "fr", fr: "en" };
const label: Record<Locale, string> = { en: "FR", fr: "EN" };

/**
 * Ghost icon button showing target locale ("FR" when English, "EN" when French).
 * Always renders the same Button element to match ThemeToggle's pattern — no DOM
 * swap on mount, no layout shift in flex containers. Sets `nln-locale` cookie,
 * then soft-refreshes server components so they pick up the new locale without
 * losing demo mock state (§3.5 — a hard reload would reset the sandbox).
 */
export function LocaleToggle({ className }: { className?: string }) {
  const router = useRouter();
  const intlLocale = useLocale();
  const [mounted, setMounted] = useState(false);
  const current =
    mounted && intlLocale === "fr" ? "fr" : getLocaleCookie();
  const target = opposite[current];

  useEffect(() => setMounted(true), []);

  function handleToggle() {
    setLocaleCookie(target);
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={
        mounted
          ? target === "fr"
            ? "Switch to French"
            : "Switch to English"
          : "Change language"
      }
      onClick={handleToggle}
    >
      {mounted ? (
        <span className="text-xs font-bold tabular-nums">{label[target]}</span>
      ) : (
        <Languages className="size-4" />
      )}
    </Button>
  );
}
