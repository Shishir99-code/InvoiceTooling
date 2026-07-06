"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { scheduleSlots, settings, students } from "@/lib/db/schema";
import { DEFAULT_TIMEZONE, todayInZone } from "@/lib/schedule/time";
import { slotFormSchema } from "@/lib/validation/schedule";

export interface SlotActionState {
  fieldErrors: Record<string, string[]> | null;
}

// editSlotAction needs the row id in addition to the shared form fields —
// extended locally here (mirrors editSessionSchema in lib/actions/sessions.ts).
const editSlotSchema = slotFormSchema.extend({
  id: z.coerce.number("Invalid slot.").int().positive("Invalid slot."),
});

function parseAddSlotForm(formData: FormData) {
  return slotFormSchema.safeParse({
    studentId: formData.get("studentId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMinutes: formData.get("durationMinutes"),
  });
}

function parseEditSlotForm(formData: FormData) {
  return editSlotSchema.safeParse({
    id: formData.get("id"),
    studentId: formData.get("studentId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMinutes: formData.get("durationMinutes"),
  });
}

export async function addSlotAction(
  _prevState: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const parsed = parseAddSlotForm(formData);

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

  // D-08: effectiveDate = creation date in the tutor's timezone — the auto-log
  // floor, so no retroactive backfill before the slot existed. Timezone comes
  // from the trusted settings row (never client input), with the P4 fallback.
  const [settingsRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, 1));
  const tz = settingsRow?.timezone ?? DEFAULT_TIMEZONE;

  await db.insert(scheduleSlots).values({
    studentId: parsed.data.studentId,
    weekday: parsed.data.weekday,
    startTime: parsed.data.startTime,
    durationMinutes: parsed.data.durationMinutes,
    effectiveDate: todayInZone(tz),
    lastLoggedDate: null, // D-05: never processed yet
  });

  revalidatePath("/");
  return { fieldErrors: null };
}

export async function editSlotAction(
  _prevState: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const parsed = parseEditSlotForm(formData);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // D-06: editing a slot only changes FUTURE auto-logs. Update only the three
  // form fields — never touch effectiveDate/lastLoggedDate, and never rewrite
  // any sessions already logged from this slot.
  await db
    .update(scheduleSlots)
    .set({
      weekday: parsed.data.weekday,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
    })
    .where(eq(scheduleSlots.id, parsed.data.id));

  revalidatePath("/");
  return { fieldErrors: null };
}

// D-06: removing a slot must never delete billing history. The schema's
// sessions.scheduleSlotId onDelete "set null" nulls the FK on any sessions
// logged from this slot — those rows are preserved.
export async function deleteSlotAction(id: number): Promise<void> {
  const slotId = Number(id);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    throw new Error("Invalid slot id.");
  }

  await db.delete(scheduleSlots).where(eq(scheduleSlots.id, slotId));

  revalidatePath("/");
}
