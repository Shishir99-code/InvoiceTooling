"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { invoices, sessions, settings, students } from "@/lib/db/schema";
import { formatCents } from "@/lib/format";
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
} from "@/lib/invoice/defaults";
import {
  buildLineItems,
  formatPeriod,
  renderInvoiceText,
  renderTemplate,
} from "@/lib/invoice/render";
import { invoiceGenerateSchema } from "@/lib/validation/invoice";

export interface InvoiceActionState {
  fieldErrors: Record<string, string[]> | null;
  invoiceId: number | null;
}

// INV-01..04: generating an invoice totals ALL of a student's unbilled
// sessions, atomically freezes an immutable snapshot, and marks those
// sessions billed. Only `studentId` crosses the client boundary — everything
// else (sessions, student, settings) is re-fetched server-side (T-03-04).
export async function generateInvoiceAction(
  _prevState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = invoiceGenerateSchema.safeParse({
    studentId: formData.get("studentId"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      invoiceId: null,
    };
  }

  const { studentId } = parsed.data;

  // Re-SELECT unbilled sessions server-side — never trust a client-echoed
  // session-id list or total (Anti-Patterns / T-03-04). Unbilled means
  // billed: false (equivalent to `eq(sessions.billed, false)` below).
  const unbilledSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.studentId, studentId), eq(sessions.billed, false)))
    .orderBy(asc(sessions.date));

  if (unbilledSessions.length === 0) {
    // Defensive race guard (UI-SPEC) — the trigger is hidden at $0 in the
    // normal path, but a second tab/duplicate submit could still race here.
    return {
      fieldErrors: {
        studentId: ["This student has no unbilled sessions to invoice."],
      },
      invoiceId: null,
    };
  }

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId));

  if (!student) {
    return {
      fieldErrors: { studentId: ["Select a student."] },
      invoiceId: null,
    };
  }

  const [settingsRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, 1));

  const subjectTemplate =
    settingsRow?.subjectTemplate ?? DEFAULT_SUBJECT_TEMPLATE;
  const bodyTemplate = settingsRow?.bodyTemplate ?? DEFAULT_BODY_TEMPLATE;
  const zelleHandle = settingsRow?.zelleHandle ?? "";

  // P2 D-14: total is the sum of each session's stored amountCents, never
  // re-derived from the student's current rate.
  const totalCents = unbilledSessions.reduce(
    (sum, session) => sum + session.amountCents,
    0,
  );
  const periodStart = unbilledSessions[0].date;
  const periodEnd = unbilledSessions[unbilledSessions.length - 1].date;
  const period = formatPeriod(periodStart, periodEnd);

  const lineItems = buildLineItems(unbilledSessions);
  const invoiceBlock = renderInvoiceText(student.name, period, lineItems);

  const mergeValues = {
    invoice: invoiceBlock,
    student: student.name,
    total: formatCents(totalCents),
    zelle: zelleHandle,
    period,
  };

  // Pitfall 4: freeze the FULLY rendered body + subject now — never
  // re-rendered from a live Settings read later.
  const renderedBody = renderTemplate(bodyTemplate, mergeValues);
  const renderedSubject = renderTemplate(subjectTemplate, mergeValues);

  // Pitfall 1 resolution 1 (single-user, low-concurrency app): a lone
  // INSERT...RETURNING id first — a single INSERT is atomic per normal SQL
  // semantics on its own — THEN a db.batch for the sessions UPDATE. The
  // interactive transaction() API is NOT used (Pitfall 2 — it throws at
  // runtime on the neon-http driver this project uses).
  const [row] = await db
    .insert(invoices)
    .values({
      studentId,
      periodStart,
      periodEnd,
      totalCents,
      lineItems,
      renderedBody,
      renderedSubject,
    })
    .returning({ id: invoices.id });

  await db.batch([
    db
      .update(sessions)
      .set({ billed: true, invoiceId: row.id })
      .where(
        inArray(
          sessions.id,
          unbilledSessions.map((session) => session.id),
        ),
      ),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/history");

  return { fieldErrors: null, invoiceId: row.id };
}
