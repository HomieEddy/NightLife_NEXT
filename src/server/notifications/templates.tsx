/**
 * Register all notification templates at import time.
 * This file is the single JSX import point — route handlers stay as .ts.
 */
import { render } from "@react-email/components";
import { registerTemplate } from "./dispatch";
import { StaffInviteEmail } from "@/emails/staff-invite";
import { ReservationConfirmationEmail } from "@/emails/reservation-confirmation";
import { ReportRunEmail } from "@/emails/report-run";
import { LeadAcknowledgementEmail } from "@/emails/lead-acknowledgement";

registerTemplate("staff-invite", "You've been invited to join NightLife", (data) =>
  render(<StaffInviteEmail {...(data as unknown as Parameters<typeof StaffInviteEmail>[0])} />),
);

registerTemplate("reservation-confirmation", "Your reservation is confirmed", (data) =>
  render(<ReservationConfirmationEmail {...(data as unknown as Parameters<typeof ReservationConfirmationEmail>[0])} />),
);

registerTemplate("report-run", "Your scheduled report is ready", (data) =>
  render(<ReportRunEmail {...(data as unknown as Parameters<typeof ReportRunEmail>[0])} />),
);

registerTemplate("lead-acknowledgement", "Thanks for your interest in NightLife", (data) =>
  render(<LeadAcknowledgementEmail {...(data as unknown as Parameters<typeof LeadAcknowledgementEmail>[0])} />),
);
