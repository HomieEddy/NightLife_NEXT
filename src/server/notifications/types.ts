/** One delivery attempt log — append-only, keyed by (channel, template, recipient, idempotencyKey). */
export interface NotificationLogEntry {
  id: string;
  venueId: string;
  channel: "email" | "sms" | "push";
  template: string;
  recipient: string;
  status: "queued" | "sent" | "failed";
  providerId?: string;
  error?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationRecipient {
  email?: string;
  phone?: string;
  /** Per-channel opt-in — default true for transactional sends initiated by the recipient's own action. */
  channels?: { email?: boolean; sms?: boolean };
}

export interface DispatchPayload {
  venueId: string;
  template: string;
  recipients: NotificationRecipient[];
  data: Record<string, unknown>;
  /** A stable idempotency key — same key twice only sends once (checked against NotificationLog). */
  idempotencyKey?: string;
}
