import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { students } from "@/lib/db/schema";

// Base validation for the `name` column, derived from the Drizzle table so a
// future column rename can't silently desync from this validator.
const baseStudentSchema = createInsertSchema(students, {
  name: z.string().trim().min(1, "Enter a name."),
});

// Form-facing schema: the DB stores `rateCents` (integer), but the user types
// plain dollars (D-07) — `rateDollars` is converted to cents at the Server
// Action boundary via Math.round (never stored as a raw float). Email is
// required and format-validated per D-13.
export const studentFormSchema = baseStudentSchema.pick({ name: true }).extend({
  rateDollars: z.coerce
    .number({ error: "Rate must be a positive number." })
    .positive("Rate must be a positive number."),
  parentEmail: z.email("Enter a valid email."),
  // ZOOM-01: optional per-student Zoom link. Blank → undefined (no error);
  // when present it must be an http(s) URL. A scheme-less or javascript:/ftp:
  // value is rejected (never coerced) so only a safe link ever reaches storage.
  zoomLink: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .url("Enter a valid link starting with http:// or https://")
      .refine(
        (u) => /^https?:\/\//i.test(u),
        "Link must start with http:// or https://",
      )
      .optional(),
  ),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;
