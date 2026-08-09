"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Global error boundary — catches errors in the root error boundary itself.
 * Must render its own <html>/<body> (Next replaces the whole document).
 */
export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-deep dark:text-gold">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-display text-2xl">Something went wrong</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            This screen hit an unexpected error. Your data is safe — try again.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <RefreshCw className="size-4" /> Try again
        </button>
        {error.digest && (
          <p className="font-mono text-[0.65rem] text-muted-foreground/60">ref: {error.digest}</p>
        )}
      </body>
    </html>
  );
}
