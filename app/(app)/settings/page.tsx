import { eq } from "drizzle-orm";

import { SettingsForm } from "@/components/settings-form";
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
      <div className="mt-6">
        <SettingsForm
          zelleHandle={row?.zelleHandle ?? ""}
          subjectTemplate={row?.subjectTemplate ?? DEFAULT_SUBJECT_TEMPLATE}
          bodyTemplate={row?.bodyTemplate ?? DEFAULT_BODY_TEMPLATE}
        />
      </div>
    </div>
  );
}
