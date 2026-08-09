import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Query error state — replaces the perpetual skeleton a failed useQuery
 * used to show. Retry re-runs every active query for the page.
 */
export function QueryErrorState({
  queryKeys,
  message,
  onRetry,
}: {
  /** Invalidate these keys to retry (all keys when omitted). */
  queryKeys?: readonly (readonly unknown[])[];
  message?: string;
  /** Custom retry for non-query fetchers (useEffect + state pages). */
  onRetry?: () => void;
}) {
  const queryClient = useQueryClient();

  function retry() {
    if (onRetry) {
      onRetry();
      return;
    }
    if (queryKeys) {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key as never });
      }
    } else {
      queryClient.invalidateQueries();
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="size-5 text-destructive" />
      <p className="text-sm font-medium">{message ?? "Could not load this data."}</p>
      <p className="text-xs text-muted-foreground">
        Your connection or the server hiccuped — nothing was lost.
      </p>
      <Button size="sm" variant="outline" onClick={retry}>
        <RefreshCw className="size-3.5" /> Retry
      </Button>
    </div>
  );
}

/** Page-level variant with a link back home for fatal loads. */
export function QueryErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="text-sm font-medium">This page could not load.</p>
      <Button size="sm" variant="outline" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
