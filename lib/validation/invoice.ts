import { z } from "zod";

// Invoice content is never user-typed — the rendered text, line items, and
// totals are all derived server-side from unbilled sessions + Settings at
// generate time. This schema validates only the studentId that crosses the
// preview-modal -> generateInvoiceAction boundary (T-03-04: everything else
// is re-fetched server-side, never trusted from the client).
// Plan 04: optional throughDate cutoff restricts billed sessions to on-or-before
// a specified date (manual generate only; cadence always bills all unbilled).
export const invoiceGenerateSchema = z.object({
  studentId: z.coerce
    .number("Invalid student.")
    .int()
    .positive("Invalid student."),
  throughDate: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string("Enter a valid date.")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
      .optional(),
  ),
});

export type InvoiceGenerateValues = z.infer<typeof invoiceGenerateSchema>;
