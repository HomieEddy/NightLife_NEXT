import { z } from "zod";

export const zPushSubscribe = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const zPushUnsubscribe = z.object({
  endpoint: z.string().url(),
});

export const zNotificationPreference = z.object({
  eventType: z.string().min(1),
  channel: z.enum(["push", "email", "sms"]),
  enabled: z.boolean(),
});

export const zPreferencesPut = z.object({
  preferences: z.array(zNotificationPreference),
});
