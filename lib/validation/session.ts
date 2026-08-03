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
  makeup: z.coerce.boolean().default(false), // MK-01: internal label only, never affects amount
});

export const sessionFormSchema = baseSessionSchema
  .pick({
    studentId: true,
    date: true,
    durationMinutes: true,
    notes: true,
    makeup: true,
  })
  .extend({
    // PRICE-01: optional manual override of the computed amount. Blank means
    // "recompute from the student's rate" (the historic behaviour), so an
    // untouched form keeps working exactly as before. Typed in dollars like
    // the student rate field and rounded to cents at the action boundary —
    // never stored as a float (D-07).
    amountDollars: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.coerce
        .number("Enter a valid amount.")
        .min(0, "Amount can't be negative.")
        .max(100000, "Amount is too large.")
        .optional(),
    ),
  });

export type SessionFormValues = z.infer<typeof sessionFormSchema>;
