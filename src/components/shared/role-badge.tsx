import { cn } from "@/lib/utils";
import type { StaffRole } from "@/lib/types";

const ROLE_STYLES: Record<StaffRole, string> = {
  manager: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  host: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  bartender: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
  runner: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  security: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  promoter: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

export function RoleBadge({ role, className }: { role: StaffRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_oklch(1_0_0/12%)] backdrop-blur",
        ROLE_STYLES[role],
        className,
      )}
    >
      {role}
    </span>
  );
}
