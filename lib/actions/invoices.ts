"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
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
  // MAIL-05: on success, the raw pieces the CLIENT uses to build the Gmail
  // compose URL and auto-open the draft (the action never builds the URL or
  // sends — sending stays client-side). null on every failure path.
  emailDraft: { to: string; subject: string; body: string } | null;
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
      emailDraft: null,
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
      emailDraft: null,
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
      emailDraft: null,
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

  // T-03-05-01: the invoice INSERT and the sessions mark-billed UPDATE MUST
  // commit as one unit — a crash between two separate writes (or a two-tab
  // race) could otherwise leave sessions un-billed under a persisted
  // invoice, or let the same sessions be billed twice. This is a single
  // data-modifying CTE run via db.execute, wrapped in ONE db.batch call (the
  // interactive transaction() API is NOT used — it throws at runtime on the
  // neon-http driver this project uses). The INSERT is itself gated on all
  // target sessions still being unbilled (double-billing guard): if a
  // concurrent generation already claimed any of them, `ins` inserts zero
  // rows and the trailing UPDATE (gated on `EXISTS (SELECT 1 FROM ins)`)
  // updates zero rows too — no partial commit, no double invoice.
  const sessionIds = unbilledSessions.map((session) => session.id);
  const targetFilter = and(
    inArray(sessions.id, sessionIds),
    eq(sessions.billed, false),
  );

  let newInvoiceId: number | null = null;

  try {
    const [result] = await db.batch([
      db.execute<{ invoice_id: number }>(sql`
        WITH target AS (
          SELECT id FROM sessions WHERE ${targetFilter}
        ),
        ins AS (
          INSERT INTO invoices (
            student_id, period_start, period_end, total_cents,
            line_items, rendered_body, rendered_subject
          )
          SELECT ${studentId}, ${periodStart}, ${periodEnd}, ${totalCents},
            ${JSON.stringify(lineItems)}::jsonb, ${renderedBody}, ${renderedSubject}
          WHERE (SELECT count(*) FROM target) = ${sessionIds.length}
          RETURNING id
        )
        UPDATE sessions
        SET billed = true, invoice_id = (SELECT id FROM ins)
        WHERE ${targetFilter} AND EXISTS (SELECT 1 FROM ins)
        RETURNING (SELECT id FROM ins) AS invoice_id
      `),
    ]);

    newInvoiceId = result.rows[0]?.invoice_id ?? null;
  } catch {
    return {
      fieldErrors: {
        studentId: ["Couldn't generate the invoice — please try again."],
      },
      invoiceId: null,
      emailDraft: null,
    };
  }

  if (newInvoiceId === null) {
    // The race was lost: another generation already claimed one or more of
    // these sessions between our re-SELECT above and this write.
    return {
      fieldErrors: {
        studentId: [
          "These sessions were already invoiced in another request. Please refresh and try again.",
        ],
      },
      invoiceId: null,
      emailDraft: null,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");

  return {
    fieldErrors: null,
    invoiceId: newInvoiceId,
    // student.parentEmail is guaranteed present (P1 D-13 required); the client
    // builds the Gmail URL from these frozen pieces and auto-opens the draft.
    emailDraft: {
      to: student.parentEmail,
      subject: renderedSubject,
      body: renderedBody,
    },
  };
}

// D-16: the only supported mistake-recovery path — deleting an invoice
// atomically un-bills every session it covered (billed: false, invoiceId:
// null) and removes the invoice row, via db.batch (never the interactive
// transaction() API, which throws at runtime on this project's neon-http
// driver — Pitfall 2). Guarded by a positive-integer id check before any DB
// write, mirroring deleteSessionAction.
export async function deleteInvoiceAction(id: number): Promise<void> {
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    throw new Error("Invalid invoice id.");
  }

  await db.batch([
    db
      .update(sessions)
      .set({ billed: false, invoiceId: null })
      .where(eq(sessions.invoiceId, invoiceId)),
    db.delete(invoices).where(eq(invoices.id, invoiceId)),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/history");

  // Server Action throws-to-navigate — no client router plumbing needed;
  // this is why the action returns void, unlike generate which needed to
  // return the new id.
  redirect("/history");
}
