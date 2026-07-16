import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HostApprovalControl({
  approving,
  onApprove,
}: {
  approving: boolean;
  onApprove: () => void;
}) {
  return (
    <div className="relative mt-4 w-full max-w-xs space-y-2 rounded-xl border border-dashed bg-background/60 p-4 backdrop-blur animate-fade-up">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Demo control</p>
      <Button className="w-full" onClick={onApprove} disabled={approving}>
        <PartyPopper className="size-4" />
        {approving ? "Approving…" : "Simulate host approval"}
      </Button>
      <p className="text-xs text-muted-foreground">A host normally approves from the staff panel.</p>
    </div>
  );
}
