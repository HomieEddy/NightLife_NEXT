import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/60 hover:text-muted-foreground transition-colors">
          <Info className="size-3.5" />
          <span className="sr-only">Info</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-64 text-pretty">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
