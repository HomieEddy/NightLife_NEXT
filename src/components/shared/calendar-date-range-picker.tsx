"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/features/shared/utils";

export function CalendarDateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: {
  from: Date | undefined;
  to: Date | undefined;
  onFromChange: (date: Date | undefined) => void;
  onToChange: (date: Date | undefined) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[150px] justify-start text-left font-normal",
              !from && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {from ? format(from, "MMM d, yyyy") : "From"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={from}
            onSelect={onFromChange}
            disabled={(d) => (to ? d > to : false)}
          />
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted-foreground">&ndash;</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[150px] justify-start text-left font-normal",
              !to && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {to ? format(to, "MMM d, yyyy") : "To"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={to}
            onSelect={onToChange}
            disabled={(d) => (from ? d < from : false) || d > new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
