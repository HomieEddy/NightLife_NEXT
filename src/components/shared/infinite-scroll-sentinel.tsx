"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/features/shared/utils";

export function InfiniteScrollSentinel({
  onLoadMore,
  hasMore,
  loading,
  className,
}: {
  onLoadMore: () => void;
  hasMore: boolean;
  loading?: boolean;
  className?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className={cn("flex justify-center py-4", className)}>
      {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
