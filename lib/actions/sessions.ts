"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { sessions, students } from "@/lib/db/schema";
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
  });
}

function parseEditSessionForm(formData: FormData) {
  return editSessionSchema.safeParse({
    id: formData.get("id"),
    studentId: formData.get("studentId"),
    date: formData.get("date"),
    durationMinutes: formData.get("durationMinutes"),
    notes: formData.get("notes"),
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

  // Math.round avoids float drift (19.99 * 100 === 1998.999...999998 in JS) —
  // single rounding step over integer inputs (SESS-05).
  const amountCents = Math.round(
    (parsed.data.durationMinutes * student.rateCents) / 60,
  );

  await db.insert(sessions).values({
    studentId: parsed.data.studentId,
    date: parsed.data.date,
    durationMinutes: parsed.data.durationMinutes,
    amountCents,
    notes: parsed.data.notes ?? null,
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

  const amountCents = Math.round(
    (parsed.data.durationMinutes * student.rateCents) / 60,
  );

  // SESS-03: editing is allowed at any time, regardless of `billed` status —
  // `billed` only affects dashboard exclusion (DASH-02), never edit eligibility.
  await db
    .update(sessions)
    .set({
      studentId: parsed.data.studentId,
      date: parsed.data.date,
      durationMinutes: parsed.data.durationMinutes,
      amountCents,
      notes: parsed.data.notes ?? null,
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
