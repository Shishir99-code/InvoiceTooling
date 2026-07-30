import { z } from "zod";

// Confirm-one-occurrence form: slotId/date identify the derived occurrence,
// duration is editable in the dialog before saving, notes optional (mirrors
// the session form's bounds in lib/validation/session.ts usage).
export const confirmOccurrenceSchema = z.object({
  slotId: z.coerce.number("Invalid slot.").int().positive("Invalid slot."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  durationMinutes: z.coerce
    .number("Enter a session length.")
    .int()
    .min(15, "Sessions must be at least 15 minutes.")
    .max(480, "Sessions can be at most 8 hours."),
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().max(2000, "Notes are too long.").nullable(),
  ),
});

// Bulk confirm: a list of derived occurrences the client currently shows as
// pending. Each is fully re-validated server-side against the live slot.
export const bulkConfirmSchema = z
  .array(
    z.object({
      slotId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .min(1)
  .max(200);
