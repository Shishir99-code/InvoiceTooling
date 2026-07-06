import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { settings } from "@/lib/db/schema";

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

export const settingsFormSchema = baseSettingsSchema.pick({
  zelleHandle: true,
  subjectTemplate: true,
  bodyTemplate: true,
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
