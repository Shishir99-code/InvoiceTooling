import { eq } from "drizzle-orm";

import { SettingsForm } from "@/components/settings-form";
import { EmailDeliveryForm } from "@/components/email-delivery-form";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
} from "@/lib/invoice/defaults";

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
          invoiceCadenceEnabled={row?.invoiceCadenceEnabled ?? false}
          invoiceCadenceDay={row?.invoiceCadenceDay ?? null}
          invoiceCadenceLastDay={row?.invoiceCadenceLastDay ?? false}
          autoSendInvoices={row?.autoSendInvoices ?? false}
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
