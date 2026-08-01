"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TooltipIconButtonProps extends ComponentProps<typeof Button> {
  tooltip: string;
}

/**
 * Icon-only Button with a hover/focus tooltip. Do not use as the `trigger`
 * for ConfirmDialog or as an asChild child of DropdownMenuTrigger/
 * PopoverTrigger/DialogTrigger — this component's own top-level element is
 * a Tooltip (not a DOM node), so those wrappers' asChild cloning can't
 * forward props/ref through it. Use a plain Button there instead.
 */
export function TooltipIconButton({
  tooltip,
  size = "icon",
  "aria-label": ariaLabel,
  ...props
}: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size={size} aria-label={ariaLabel ?? tooltip} {...props} />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
