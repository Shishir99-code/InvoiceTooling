import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { settings } from "@/lib/db/schema";
import { isValidIanaTimeZone } from "@/lib/settings/timezones";

// Loose validation per SET-01 Claude's Discretion — non-empty only, NO
// email/phone format enforcement on zelleHandle (it may hold either).
// WR-02: .max() bounds match the column widths (zelle_handle varchar(255),
// subject_template varchar(500), body_template text) so oversized input
// returns an inline field error instead of a raw Postgres "value too long".
const baseSettingsSchema = createInsertSchema(settings, {
  zelleHandle: z
    .string()
    .trim()
    .min(1, "Enter your Zelle handle.")
    .max(255, "Zelle handle is too long."),
  subjectTemplate: z
    .string()
    .trim()
    .min(1, "Enter an email subject line.")
    .max(500, "Subject line is too long."),
  bodyTemplate: z
    .string()
    .trim()
    .min(1, "Enter an email body template.")
    .max(5000, "Message body is too long."),
});

export const settingsFormSchema = baseSettingsSchema
  .pick({
    zelleHandle: true,
    subjectTemplate: true,
    bodyTemplate: true,
  })
  // SET-03: timezone is validated with the IANA check (not picked from
  // createInsertSchema, which would only give a plain nullable string). Blank
  // (untouched) → undefined (no error); when present it must be a recognized
  // IANA zone. Phase 4 captures it only — nothing consumes it here.
  .extend({
    timezone: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .refine(isValidIanaTimeZone, "Pick a valid timezone.")
        .optional(),
    ),
    // RINV-01: auto-invoicing cadence configuration
    invoiceCadenceEnabled: z.preprocess(
      (v) => v === "on" || v === "true" || v === true,
      z.boolean(),
    ),
    invoiceCadenceLastDay: z.preprocess(
      (v) => v === "on" || v === "true" || v === true,
      z.boolean(),
    ),
    invoiceCadenceDay: z.preprocess(
      (v) =>
        typeof v === "string" && v.trim() === "" ? undefined : v,
      z
        .coerce
        .number()
        .int()
        .min(1, "Pick a day between 1 and 28.")
        .max(28, "Pick a day between 1 and 28.")
        .optional(),
    ),
  });

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
