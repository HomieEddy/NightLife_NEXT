"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { MANAGER_SHORTCUTS } from "@/lib/shortcuts";

export function ShortcutHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {MANAGER_SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex justify-between items-center gap-4 text-sm">
              <kbd className="inline-flex items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium shadow-[inset_0_-1px_0_0] shadow-border/50">
                {s.keys.split(" ").map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </kbd>
              <span className="text-muted-foreground text-right">{s.label}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
