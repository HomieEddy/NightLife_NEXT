import {
  BellRing, CalendarPlus, AlertTriangle, ClipboardList, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StaffAction } from "./permissions";

export interface ActionCommand {
  key: string;
  label: string;
  icon: LucideIcon;
  requiredAction?: StaffAction;
  type: "navigate" | "service" | "dialog";
  href?: string;
  description?: string;
}

export const MANAGER_ACTION_COMMANDS: ActionCommand[] = [
  {
    key: "last-call",
    label: "Start last call",
    icon: Clock,
    type: "service",
    description: "Stop new orders and broadcast last call to all channels",
  },
  {
    key: "broadcast",
    label: "Send broadcast",
    icon: BellRing,
    type: "service",
    description: "Send a message to floor, bar and security channels",
  },
  {
    key: "new-reservation",
    label: "New reservation",
    icon: CalendarPlus,
    type: "dialog",
    description: "Create a reservation without leaving your current page",
  },
  {
    key: "report-incident",
    label: "Report an incident",
    icon: AlertTriangle,
    requiredAction: "incident:create",
    type: "dialog",
    description: "File an incident report immediately",
  },
  {
    key: "open-stocktake",
    label: "Open stocktake",
    icon: ClipboardList,
    requiredAction: "stocktake:count",
    type: "navigate",
    href: "/manager/inventory?tab=stocktake",
    description: "Jump to the stocktake surface",
  },
];

export const STAFF_ACTION_COMMANDS: ActionCommand[] = [
  {
    key: "report-incident",
    label: "Report an incident",
    icon: AlertTriangle,
    requiredAction: "incident:create",
    type: "dialog",
    description: "File an incident report immediately",
  },
];
