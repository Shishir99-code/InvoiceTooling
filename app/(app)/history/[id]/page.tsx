import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { InvoiceView } from "@/components/invoice-view";
import { db } from "@/lib/db";
import { invoices, students } from "@/lib/db/schema";
import type { InvoiceLineItem } from "@/lib/invoice/render";

// Invoice detail route (post-generate landing per D-09, and History's "open"
// target per D-15/HIST-02 in a later plan). Renders ENTIRELY from the frozen
// `invoices` columns — never queries `sessions` (Pitfall 4 / INV-04).
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const [row] = await db
    .select({
      invoice: invoices,
      studentName: students.name,
      parentEmail: students.parentEmail,
    })
    .from(invoices)
    .leftJoin(students, eq(invoices.studentId, students.id))
    .where(eq(invoices.id, id));

  if (!row) {
    notFound();
  }

  const sessionCount = (row.invoice.lineItems as InvoiceLineItem[]).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <InvoiceView
        invoiceId={row.invoice.id}
        studentName={row.studentName ?? ""}
        parentEmail={row.parentEmail ?? ""}
        periodStart={row.invoice.periodStart}
        periodEnd={row.invoice.periodEnd}
        totalCents={row.invoice.totalCents}
        generatedAt={row.invoice.generatedAt}
        renderedSubject={row.invoice.renderedSubject}
        renderedBody={row.invoice.renderedBody}
        sessionCount={sessionCount}
        sent={row.invoice.sent}
      />
    </div>
  );
}
