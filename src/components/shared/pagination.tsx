"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/features/shared/utils";

export function Pagination({
  totalItems,
  pageSize = 10,
  currentPage,
  onPageChange,
  className,
}: {
  totalItems: number;
  pageSize?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between gap-2 text-sm text-muted-foreground", className)}>
      <span>
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Returns a slice of items for the current page.
 * Works with filtered lists — pagination applies after filtering.
 */
export function paginate<T>(items: T[], page: number, pageSize = 10): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
