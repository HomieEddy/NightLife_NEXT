import { useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ACTION_META,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/permissions";
import type { StaffRole } from "@/lib/types";
import type { StaffAction } from "@/lib/permissions";

const ROLE_STYLES: Record<StaffRole, string> = {
  manager: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  host: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  bartender: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
  runner: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  security: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  promoter: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

const ROLE_COLORS: Record<StaffRole, string> = {
  manager: "violet",
  host: "cyan",
  bartender: "fuchsia",
  runner: "amber",
  security: "blue",
  promoter: "emerald",
};

function CapabilityDialog({
  role,
  open,
  onClose,
}: {
  role: StaffRole;
  open: boolean;
  onClose: () => void;
}) {
  const actions = DEFAULT_ROLE_PERMISSIONS[role];
  const categories = new Map<string, { label: string; actions: StaffAction[] }>();
  for (const action of actions) {
    const meta = ACTION_META[action as StaffAction];
    if (!meta) continue;
    const cat = categories.get(meta.category) ?? { label: meta.category, actions: [] };
    cat.actions.push(action);
    categories.set(meta.category, cat);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className={cn("capitalize text-base", `text-${ROLE_COLORS[role]}-600 dark:text-${ROLE_COLORS[role]}-400`)}>
          {role} capabilities
        </DialogTitle>
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {Array.from(categories.entries()).map(([cat, { actions: catActions }]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                {cat}
              </p>
              <ul className="space-y-0.5">
                {catActions.map((action) => {
                  const meta = ACTION_META[action as StaffAction];
                  return (
                    <li key={action} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-1 rounded-full bg-primary/40 shrink-0" />
                      <span>{meta.label}</span>
                      {meta.sensitive && (
                        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 text-[9px] text-amber-600 dark:text-amber-400">
                          sensitive
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RoleBadge({
  role,
  className,
  clickable = false,
}: {
  role: StaffRole;
  className?: string;
  clickable?: boolean;
}) {
  const [capOpen, setCapOpen] = useState(false);

  if (!clickable) {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setCapOpen(true)}
        aria-label={`${role} capabilities`}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_oklch(1_0_0/12%)] backdrop-blur cursor-pointer hover:opacity-80 transition-opacity",
          ROLE_STYLES[role],
          className,
        )}
      >
        {role}
      </button>
      <CapabilityDialog role={role} open={capOpen} onClose={() => setCapOpen(false)} />
    </>
  );
}
