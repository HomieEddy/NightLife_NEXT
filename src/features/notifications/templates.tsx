/**
 * Register all notification templates at import time.
 * This file is the single JSX import point — route handlers stay as .ts.
 */
import { render } from "@react-email/components";
import { registerTemplate } from "@/features/notifications/dispatch";
import { StaffInviteEmail } from "@/emails/staff-invite";
import { ReservationConfirmationEmail } from "@/emails/reservation-confirmation";
import { ReportRunEmail } from "@/emails/report-run";
import { LeadAcknowledgementEmail } from "@/emails/lead-acknowledgement";
import { StaffInviteEmailFr } from "@/emails/fr/staff-invite";
import { ReservationConfirmationEmailFr } from "@/emails/fr/reservation-confirmation";
import { ReportRunEmailFr } from "@/emails/fr/report-run";
import { LeadAcknowledgementEmailFr } from "@/emails/fr/lead-acknowledgement";

// English (default)
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

// French variants — keyed "template:fr", selected by DispatchPayload.locale
registerTemplate("staff-invite:fr", "Vous avez été invité à rejoindre NightLife", (data) =>
  render(<StaffInviteEmailFr {...(data as unknown as Parameters<typeof StaffInviteEmailFr>[0])} />),
);
registerTemplate("reservation-confirmation:fr", "Votre réservation est confirmée", (data) =>
  render(<ReservationConfirmationEmailFr {...(data as unknown as Parameters<typeof ReservationConfirmationEmailFr>[0])} />),
);
registerTemplate("report-run:fr", "Votre rapport planifié est prêt", (data) =>
  render(<ReportRunEmailFr {...(data as unknown as Parameters<typeof ReportRunEmailFr>[0])} />),
);
registerTemplate("lead-acknowledgement:fr", "Merci de votre intérêt pour NightLife", (data) =>
  render(<LeadAcknowledgementEmailFr {...(data as unknown as Parameters<typeof LeadAcknowledgementEmailFr>[0])} />),
);
