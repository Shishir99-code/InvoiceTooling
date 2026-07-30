"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { scheduleSlots, sessions, settings, students } from "@/lib/db/schema";
import { DEFAULT_TIMEZONE, todayInZone, weekdayOf } from "@/lib/schedule/time";
import { computeAmountCents } from "@/lib/sessions/amount";
import {
  bulkConfirmSchema,
  confirmOccurrenceSchema,
} from "@/lib/validation/calendar";

export interface ConfirmOccurrenceState {
  fieldErrors: Record<string, string[]> | null;
}

interface OccurrenceSlotInfo {
  id: number;
  studentId: number;
  weekday: number;
  durationMinutes: number;
  effectiveDate: string;
  rateCents: number;
}

type OccurrenceCheck =
  | { error: string; slot?: never }
  | { error?: never; slot: OccurrenceSlotInfo };

// Shared guard: load the slot (+ current rate), and reject anything that isn't
// a real, past-or-today, not-yet-logged occurrence of that slot. Every check
// re-derives from the DB — the client's pending list is a hint, never trusted.
async function validateOccurrence(
  slotId: number,
  date: string,
): Promise<OccurrenceCheck> {
  const [slot] = await db
    .select({
      id: scheduleSlots.id,
      studentId: scheduleSlots.studentId,
      weekday: scheduleSlots.weekday,
      durationMinutes: scheduleSlots.durationMinutes,
      effectiveDate: scheduleSlots.effectiveDate,
      rateCents: students.rateCents,
    })
    .from(scheduleSlots)
    .innerJoin(students, eq(scheduleSlots.studentId, students.id))
    .where(eq(scheduleSlots.id, slotId));

  if (!slot) return { error: "This class slot no longer exists." };

  if (weekdayOf(date) !== slot.weekday) {
    return { error: "That date doesn't fall on this slot's class day." };
  }
  if (date < slot.effectiveDate) {
    return { error: "That date is before this slot was created." };
  }

  const [settingsRow] = await db
    .select({ timezone: settings.timezone })
    .from(settings)
    .where(eq(settings.id, 1));
  const today = todayInZone(settingsRow?.timezone ?? DEFAULT_TIMEZONE);
  if (date > today) {
    return { error: "Future sessions can't be logged yet." };
  }

  const [existing] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.scheduleSlotId, slotId), eq(sessions.date, date)));
  if (existing) {
    return { error: "This session is already logged." };
  }

  return { slot };
}

// Calendar confirm (single occurrence): creates the session row that the
// derived pending occurrence stood in for. scheduleSlotId records provenance —
// same column the old auto-log used, so downstream markers keep working.
export async function confirmOccurrenceAction(
  _prevState: ConfirmOccurrenceState,
  formData: FormData,
): Promise<ConfirmOccurrenceState> {
  const parsed = confirmOccurrenceSchema.safeParse({
    slotId: formData.get("slotId"),
    date: formData.get("date"),
    durationMinutes: formData.get("durationMinutes"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await validateOccurrence(parsed.data.slotId, parsed.data.date);
  if (result.error !== undefined) {
    return { fieldErrors: { _form: [result.error] } };
  }

  await db.insert(sessions).values({
    studentId: result.slot.studentId,
    date: parsed.data.date,
    durationMinutes: parsed.data.durationMinutes,
    amountCents: computeAmountCents(
      parsed.data.durationMinutes,
      result.slot.rateCents,
    ),
    notes: parsed.data.notes,
    billed: false,
    scheduleSlotId: result.slot.id,
  });

  revalidatePath("/calendar");
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  return { fieldErrors: null };
}

export interface BulkConfirmResult {
  ok: boolean;
  logged: number;
  skipped: number;
  error?: string;
}

// Bulk confirm: logs each pending occurrence with the slot's default duration.
// Sequential inserts with per-item guards (Neon HTTP driver has no
// transactions) — one bad item is skipped, the rest still log.
export async function bulkConfirmOccurrencesAction(
  items: Array<{ slotId: number; date: string }>,
): Promise<BulkConfirmResult> {
  const parsed = bulkConfirmSchema.safeParse(items);
  if (!parsed.success) {
    return { ok: false, logged: 0, skipped: 0, error: "Invalid selection." };
  }

  let logged = 0;
  let skipped = 0;

  for (const item of parsed.data) {
    try {
      const result = await validateOccurrence(item.slotId, item.date);
      if (result.error !== undefined) {
        skipped++;
        continue;
      }

      await db.insert(sessions).values({
        studentId: result.slot.studentId,
        date: item.date,
        durationMinutes: result.slot.durationMinutes,
        amountCents: computeAmountCents(
          result.slot.durationMinutes,
          result.slot.rateCents,
        ),
        notes: null,
        billed: false,
        scheduleSlotId: result.slot.id,
      });
      logged++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  return { ok: true, logged, skipped };
}
