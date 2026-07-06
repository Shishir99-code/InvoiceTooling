import { z } from "zod";

// Invoice content is never user-typed — the rendered text, line items, and
// totals are all derived server-side from unbilled sessions + Settings at
// generate time. This schema validates only the studentId that crosses the
// preview-modal -> generateInvoiceAction boundary (T-03-04: everything else
// is re-fetched server-side, never trusted from the client).
export const invoiceGenerateSchema = z.object({
  studentId: z.coerce
    .number("Invalid student.")
    .int()
    .positive("Invalid student."),
});

export type InvoiceGenerateValues = z.infer<typeof invoiceGenerateSchema>;
