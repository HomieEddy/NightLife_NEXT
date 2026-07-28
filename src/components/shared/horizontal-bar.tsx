"use client";

export function HorizontalBar({
  left,
  right,
  ratio,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        {left}
        {right}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
