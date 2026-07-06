"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { settingsFormSchema } from "@/lib/validation/settings";

export interface SettingsActionState {
  fieldErrors: Record<string, string[]> | null;
}

function parseSettingsForm(formData: FormData) {
  return settingsFormSchema.safeParse({
    zelleHandle: formData.get("zelleHandle"),
    subjectTemplate: formData.get("subjectTemplate"),
    bodyTemplate: formData.get("bodyTemplate"),
    timezone: formData.get("timezone"),
  });
}

// SET-01/SET-02, V5 zod boundary: single-row upsert (id is always 1) — the
// settings table has exactly one row, so a fresh visit inserts it and every
// subsequent save updates it via onConflictDoUpdate.
export async function saveSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = parseSettingsForm(formData);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  await db
    .insert(settings)
    .values({
      id: 1,
      zelleHandle: parsed.data.zelleHandle,
      subjectTemplate: parsed.data.subjectTemplate,
      bodyTemplate: parsed.data.bodyTemplate,
      timezone: parsed.data.timezone ?? null,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        zelleHandle: parsed.data.zelleHandle,
        subjectTemplate: parsed.data.subjectTemplate,
        bodyTemplate: parsed.data.bodyTemplate,
        timezone: parsed.data.timezone ?? null,
      },
    });

  revalidatePath("/settings");
  return { fieldErrors: null };
}
