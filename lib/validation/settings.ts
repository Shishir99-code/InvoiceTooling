import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { settings } from "@/lib/db/schema";

// Loose validation per SET-01 Claude's Discretion — non-empty only, NO
// email/phone format enforcement on zelleHandle (it may hold either).
const baseSettingsSchema = createInsertSchema(settings, {
  zelleHandle: z.string().trim().min(1, "Enter your Zelle handle."),
  subjectTemplate: z.string().trim().min(1, "Enter an email subject line."),
  bodyTemplate: z.string().trim().min(1, "Enter an email body template."),
});

export const settingsFormSchema = baseSettingsSchema.pick({
  zelleHandle: true,
  subjectTemplate: true,
  bodyTemplate: true,
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
