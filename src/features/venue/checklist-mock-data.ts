import type { ChecklistTemplate } from "@/lib/types";

export const mockChecklistTemplates: ChecklistTemplate[] = [
  {
    id: "clt-opening",
    venueId: "venue-1",
    name: "Opening Checklist",
    type: "opening",
    active: true,
    items: [
      { id: "op-1", label: "Verify emergency exits are clear and lit", required: true },
      { id: "op-2", label: "Test fire alarm and suppression panel", required: true },
      { id: "op-3", label: "Check first-aid kits stocked and accessible", required: true },
      { id: "op-4", label: "Verify POS terminals and payment processing", required: true },
      { id: "op-5", label: "Set up coat check station", required: false },
      { id: "op-6", label: "Confirm DJ/sound system operational", required: true },
      { id: "op-7", label: "Inspect restrooms — stocked and clean", required: true },
      { id: "op-8", label: "Verify liquor inventory matches opening counts", required: true },
      { id: "op-9", label: "Brief security team on tonight's events and VIP list", required: true },
      { id: "op-10", label: "Unlock and test all entry/exit doors", required: true },
    ],
  },
  {
    id: "clt-closing",
    venueId: "venue-1",
    name: "Closing Checklist",
    type: "closing",
    active: true,
    items: [
      { id: "cl-1", label: "Confirm all guests have exited the venue", required: true },
      { id: "cl-2", label: "Close and reconcile all open tabs", required: true },
      { id: "cl-3", label: "Lock all entry/exit doors", required: true },
      { id: "cl-4", label: "Secure cash and run end-of-night deposit", required: true },
      { id: "cl-5", label: "Record closing liquor inventory counts", required: true },
      { id: "cl-6", label: "File any outstanding incident reports", required: true },
      { id: "cl-7", label: "Power down sound and lighting systems", required: true },
      { id: "cl-8", label: "Inspect restrooms and common areas", required: false },
      { id: "cl-9", label: "Set security alarm system", required: true },
      { id: "cl-10", label: "Submit shift summary to management", required: false },
    ],
  },
];
