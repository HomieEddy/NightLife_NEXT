"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";

/**
 * Root error boundary — branded replacement for Next's bare "Application
 * error" page. Resets the segment; if that fails, reload loses in-memory
 * demo state but recovers the screen.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs")
        .then((Sentry) => Sentry.captureException(error))
        .catch(() => {});
    }
  }, [error]);

  return (
    <div className="grain-overlay flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <BrandLogo />
      <div className="flex size-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-deep dark:text-gold">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-2">
        <h1 className="text-display text-2xl">Something went wrong</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          This screen hit an unexpected error. Your data is safe — try again, or head back to
          the start.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="font-mono text-[0.65rem] text-muted-foreground/60">ref: {error.digest}</p>
      )}
    </div>
  );
}
