import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Generic loading placeholder for card lists. */
export function ListSkeleton({
  rows = 3,
  rowHeight = "h-24",
  className,
}: {
  rows?: number;
  rowHeight?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-xl", rowHeight)} />
      ))}
    </div>
  );
}
