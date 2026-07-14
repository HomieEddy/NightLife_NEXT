import { FastForward, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderProgressControl({ busy, onProgress }: { busy: boolean; onProgress: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onProgress} disabled={busy}>
      <FastForward className="size-3.5" /> Simulate progress
    </Button>
  );
}

export function ClosureApprovalControl({ busy, onApprove }: { busy: boolean; onApprove: () => void }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Demo control</p>
      <Button variant="outline" className="w-full" onClick={onApprove} disabled={busy}>
        <PartyPopper className="size-4" /> Simulate host approval
      </Button>
    </div>
  );
}
