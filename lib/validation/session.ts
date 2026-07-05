import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { sessions } from "@/lib/db/schema";

// Base validation derived from the Drizzle table so a future column rename
// can't silently desync from this validator (mirrors lib/validation/student.ts).
// Client-facing overrides: studentId/durationMinutes coerce from FormData
// strings to numbers; date uses zod v4's z.iso.date() to match the `date`
// column's mode: "string" (Pitfall 2 — never round-trip through a JS Date);
// notes is optional and bounded.
const baseSessionSchema = createInsertSchema(sessions, {
  studentId: z.coerce
    .number("Select a student.")
    .int()
    .positive("Select a student."),
  date: z.iso.date("Enter a valid date."),
  durationMinutes: z.coerce
    .number()
    .int()
    .positive("Session length must be more than 0 minutes."),
  notes: z.string().trim().max(1000).optional(),
});

export const sessionFormSchema = baseSessionSchema.pick({
  studentId: true,
  date: true,
  durationMinutes: true,
  notes: true,
});

export type SessionFormValues = z.infer<typeof sessionFormSchema>;
