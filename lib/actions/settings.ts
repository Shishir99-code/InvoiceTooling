"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { settingsFormSchema } from "@/lib/validation/settings";
import { encryptAppPassword, createGmailTransporter } from "@/lib/mailer";

export interface SettingsActionState {
  fieldErrors: Record<string, string[]> | null;
}

function parseSettingsForm(formData: FormData) {
  return settingsFormSchema.safeParse({
    zelleHandle: formData.get("zelleHandle"),
    subjectTemplate: formData.get("subjectTemplate"),
    bodyTemplate: formData.get("bodyTemplate"),
    timezone: formData.get("timezone"),
    invoiceCadenceEnabled: formData.get("invoiceCadenceEnabled"),
    invoiceCadenceDay: formData.get("invoiceCadenceDay"),
    invoiceCadenceLastDay: formData.get("invoiceCadenceLastDay"),
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
      invoiceCadenceEnabled: parsed.data.invoiceCadenceEnabled,
      invoiceCadenceDay: parsed.data.invoiceCadenceDay ?? null,
      invoiceCadenceLastDay: parsed.data.invoiceCadenceLastDay,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        zelleHandle: parsed.data.zelleHandle,
        subjectTemplate: parsed.data.subjectTemplate,
        bodyTemplate: parsed.data.bodyTemplate,
        timezone: parsed.data.timezone ?? null,
        invoiceCadenceEnabled: parsed.data.invoiceCadenceEnabled,
        invoiceCadenceDay: parsed.data.invoiceCadenceDay ?? null,
        invoiceCadenceLastDay: parsed.data.invoiceCadenceLastDay,
      },
    });

  revalidatePath("/settings");
  return { fieldErrors: null };
}

export interface UpdateGmailCredentialResult {
  ok: boolean;
  verified?: boolean;
  error?: string;
}

export async function updateGmailCredential(
  appPassword: string,
  gmailUserEmail: string,
): Promise<UpdateGmailCredentialResult> {
  // Validate app password format (16 chars, spaces removed: xxxx xxxx xxxx xxxx)
  const cleanedPassword = appPassword.replace(/\s/g, "");
  if (cleanedPassword.length !== 16) {
    return {
      ok: false,
      error: "App Password must be 16 characters (spaces will be removed)",
    };
  }

  // Validate email format
  const emailSchema = z.string().email();
  const emailValidation = emailSchema.safeParse(gmailUserEmail);
  if (!emailValidation.success) {
    return { ok: false, error: "Please enter a valid email address" };
  }

  try {
    // Encrypt the app password
    const encryptedPassword = encryptAppPassword(cleanedPassword);

    // Test verification by attempting to create a transporter and verify
    const transporter = createGmailTransporter(cleanedPassword, gmailUserEmail);
    await transporter.verify();

    // Verification succeeded - store the encrypted credential
    await db
      .update(settings)
      .set({
        gmailUserEmail,
        gmailAppPassword: encryptedPassword,
        gmailVerified: true,
        gmailLastError: null,
      })
      .where(eq(settings.id, 1));

    revalidatePath("/settings");
    return { ok: true, verified: true };
  } catch (error) {
    let errorMessage = "Failed to verify Gmail credential";

    if (error instanceof Error) {
      const message = error.message || "";
      if (message.includes("Invalid credentials")) {
        errorMessage = "Gmail credential invalid or expired";
      } else if (message.includes("timeout")) {
        errorMessage = "Network timeout — check connection and retry";
      } else {
        errorMessage = message.substring(0, 100);
      }
    }

    // Store credential with error flag
    try {
      const encryptedPassword = encryptAppPassword(cleanedPassword.replace(/\s/g, ""));
      await db
        .update(settings)
        .set({
          gmailUserEmail,
          gmailAppPassword: encryptedPassword,
          gmailVerified: false,
          gmailLastError: errorMessage,
        })
        .where(eq(settings.id, 1));
    } catch {
      // Ignore secondary storage error
    }

    revalidatePath("/settings");
    return { ok: false, verified: false, error: errorMessage };
  }
}

export async function verifyGmailCredential(): Promise<UpdateGmailCredentialResult> {
  try {
    // Fetch current credential from settings
    const result = await db
      .select({
        gmailAppPassword: settings.gmailAppPassword,
        gmailUserEmail: settings.gmailUserEmail,
      })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);

    if (!result.length || !result[0].gmailAppPassword || !result[0].gmailUserEmail) {
      return { ok: false, error: "No Gmail credential found" };
    }

    const { gmailAppPassword, gmailUserEmail } = result[0];

    // Decrypt and verify
    const { decryptAppPassword } = await import("@/lib/mailer");
    const decryptedPassword = decryptAppPassword(gmailAppPassword);
    const transporter = createGmailTransporter(decryptedPassword, gmailUserEmail);
    await transporter.verify();

    // Update verified flag
    await db
      .update(settings)
      .set({
        gmailVerified: true,
        gmailLastError: null,
      })
      .where(eq(settings.id, 1));

    revalidatePath("/settings");
    return { ok: true, verified: true };
  } catch (error) {
    let errorMessage = "Verification failed";

    if (error instanceof Error) {
      errorMessage = error.message.substring(0, 100);
    }

    // Update error flag
    await db
      .update(settings)
      .set({
        gmailVerified: false,
        gmailLastError: errorMessage,
      })
      .where(eq(settings.id, 1));

    revalidatePath("/settings");
    return { ok: false, verified: false, error: errorMessage };
  }
}
