"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { sessions, students } from "@/lib/db/schema";
import { computeAmountCents } from "@/lib/sessions/amount";
import { sessionFormSchema } from "@/lib/validation/session";

export interface SessionActionState {
  fieldErrors: Record<string, string[]> | null;
}

// editSessionAction needs the row id in addition to the shared form fields —
// extended locally here rather than exported from lib/validation/session.ts,
// which stays scoped to the add/edit form fields only.
const editSessionSchema = sessionFormSchema.extend({
  id: z.coerce.number("Invalid session.").int().positive("Invalid session."),
});

function parseAddSessionForm(formData: FormData) {
  return sessionFormSchema.safeParse({
    studentId: formData.get("studentId"),
    date: formData.get("date"),
    durationMinutes: formData.get("durationMinutes"),
    notes: formData.get("notes"),
    makeup: formData.get("makeup") === "on" || formData.get("makeup") === "true",
    amountDollars: formData.get("amountDollars"),
  });
}

function parseEditSessionForm(formData: FormData) {
  return editSessionSchema.safeParse({
    id: formData.get("id"),
    studentId: formData.get("studentId"),
    date: formData.get("date"),
    durationMinutes: formData.get("durationMinutes"),
    notes: formData.get("notes"),
    makeup: formData.get("makeup") === "on" || formData.get("makeup") === "true",
    amountDollars: formData.get("amountDollars"),
  });
}

export async function addSessionAction(
  _prevState: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseAddSessionForm(formData);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // Never trust a client-submitted rate/amount — re-fetch the authoritative
  // rateCents from the DB at write time (Pitfall 1 / T-02-01, T-02-02).
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, parsed.data.studentId));

  if (!student) {
    return { fieldErrors: { studentId: ["Select a student."] } };
  }

  // PRICE-01: an explicit amount wins; otherwise derive from the live rate.
  // Math.round mirrors the student-rate conversion — never store a raw float.
  const amountCents =
    parsed.data.amountDollars !== undefined
      ? Math.round(parsed.data.amountDollars * 100)
      : computeAmountCents(parsed.data.durationMinutes, student.rateCents);

  await db.insert(sessions).values({
    studentId: parsed.data.studentId,
    date: parsed.data.date,
    durationMinutes: parsed.data.durationMinutes,
    amountCents,
    notes: parsed.data.notes ?? null,
    makeup: parsed.data.makeup,
    billed: false,
  });

  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  return { fieldErrors: null };
}

export async function editSessionAction(
  _prevState: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseEditSessionForm(formData);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, parsed.data.studentId));

  if (!student) {
    return { fieldErrors: { studentId: ["Select a student."] } };
  }

  // PRICE-01: the amount is frozen once the session has been billed onto an
  // invoice. That invoice stores its own rendered body and total (Pitfall 4),
  // so letting the amount drift afterwards would leave a sent invoice
  // permanently disagreeing with the session list it was built from. Read the
  // live row rather than trusting anything the form submitted.
  const [current] = await db
    .select({ billed: sessions.billed, invoiceId: sessions.invoiceId })
    .from(sessions)
    .where(eq(sessions.id, parsed.data.id));

  if (!current) {
    return { fieldErrors: { _form: ["That session no longer exists."] } };
  }

  const isBilled = current.billed || current.invoiceId !== null;

  if (isBilled && parsed.data.amountDollars !== undefined) {
    return {
      fieldErrors: {
        amountDollars: [
          "This session is already on an invoice — its price is locked. Delete the invoice first to change it.",
        ],
      },
    };
  }

  // A billed session's amount stays exactly as invoiced. For unbilled ones an
  // explicit amount wins, else recompute from the live rate as before.
  const amountCents = isBilled
    ? undefined
    : parsed.data.amountDollars !== undefined
      ? Math.round(parsed.data.amountDollars * 100)
      : computeAmountCents(parsed.data.durationMinutes, student.rateCents);

  // SESS-03: the other fields stay editable at any time — `billed` gates the
  // amount only, never date/notes/duration/makeup.
  await db
    .update(sessions)
    .set({
      studentId: parsed.data.studentId,
      date: parsed.data.date,
      durationMinutes: parsed.data.durationMinutes,
      ...(amountCents !== undefined ? { amountCents } : {}),
      notes: parsed.data.notes ?? null,
      makeup: parsed.data.makeup,
    })
    .where(eq(sessions.id, parsed.data.id));

  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  return { fieldErrors: null };
}

// D-10: sessions are hard-deleted (unlike students, which only ever
// soft-archive). Guarded by a positive-integer id check before any DB write.
export async function deleteSessionAction(id: number): Promise<void> {
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error("Invalid session id.");
  }

  await db.delete(sessions).where(eq(sessions.id, sessionId));

  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}
