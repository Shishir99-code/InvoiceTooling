import { eq } from "drizzle-orm";

import { SettingsForm } from "@/components/settings-form";
import { EmailDeliveryForm } from "@/components/email-delivery-form";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
} from "@/lib/invoice/defaults";

// Render from the live DB on every request — never serve a build-time
// prerendered snapshot (sessions written outside a Server Action were
// invisible on Vercel until the next deploy).
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">
        Settings
      </h1>
      <div className="mt-6 flex flex-col gap-8">
        <SettingsForm
          zelleHandle={row?.zelleHandle ?? ""}
          subjectTemplate={row?.subjectTemplate ?? DEFAULT_SUBJECT_TEMPLATE}
          bodyTemplate={row?.bodyTemplate ?? DEFAULT_BODY_TEMPLATE}
          timezone={row?.timezone ?? null}
        />
        <div className="border-t pt-8">
          <EmailDeliveryForm
            gmailUserEmail={row?.gmailUserEmail}
            gmailVerified={row?.gmailVerified}
            gmailLastError={row?.gmailLastError}
          />
        </div>
      </div>
    </div>
  );
}
