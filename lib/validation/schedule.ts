import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { scheduleSlots } from "@/lib/db/schema";

// Validation derived from the scheduleSlots table (mirrors lib/validation/session.ts)
// so a column rename can't silently desync. Client-facing overrides: studentId/
// weekday/durationMinutes coerce from FormData strings; startTime is a 24h "HH:mm"
// string. Server-assigned columns (id, effectiveDate, lastLoggedDate, createdAt)
// are excluded via .pick — never taken from the form.
const baseSlotSchema = createInsertSchema(scheduleSlots, {
  studentId: z.coerce
    .number("Select a student.")
    .int()
    .positive("Select a student."),
  weekday: z.coerce.number().int().min(0).max(6), // 0=Sun … 6=Sat
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a start time."),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(15, "Length must be at least 15 minutes."),
});

export const slotFormSchema = baseSlotSchema.pick({
  studentId: true,
  weekday: true,
  startTime: true,
  durationMinutes: true,
});

export type SlotFormValues = z.infer<typeof slotFormSchema>;
