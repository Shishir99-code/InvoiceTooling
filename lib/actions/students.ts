"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { studentFormSchema } from "@/lib/validation/student";

export interface StudentActionState {
  fieldErrors: Record<string, string[]> | null;
}

const initialStudentActionState: StudentActionState = { fieldErrors: null };

// editStudentAction needs the row id in addition to the shared form fields —
// extended locally here rather than exported from lib/validation/student.ts,
// which stays scoped to the add/edit form fields only.
const editStudentSchema = studentFormSchema.extend({
  id: z.coerce.number("Invalid student.").int().positive("Invalid student."),
});

function parseAddForm(formData: FormData) {
  return studentFormSchema.safeParse({
    name: formData.get("name"),
    rateDollars: formData.get("rateDollars"),
    parentEmail: formData.get("parentEmail"),
  });
}

function parseEditForm(formData: FormData) {
  return editStudentSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    rateDollars: formData.get("rateDollars"),
    parentEmail: formData.get("parentEmail"),
  });
}

export async function addStudentAction(
  _prevState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = parseAddForm(formData);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // D-09: duplicate names are allowed — no uniqueness check performed here.
  await db.insert(students).values({
    name: parsed.data.name,
    // Math.round avoids float drift (19.99 * 100 === 1998.999...999998 in JS).
    rateCents: Math.round(parsed.data.rateDollars * 100),
    parentEmail: parsed.data.parentEmail,
    archived: false,
  });

  revalidatePath("/");
  return initialStudentActionState;
}

export async function editStudentAction(
  _prevState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = parseEditForm(formData);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  await db
    .update(students)
    .set({
      name: parsed.data.name,
      rateCents: Math.round(parsed.data.rateDollars * 100),
      parentEmail: parsed.data.parentEmail,
    })
    .where(eq(students.id, parsed.data.id));

  revalidatePath("/");
  return initialStudentActionState;
}
