"use client";

import { useState } from "react";
import { format } from "date-fns";

import { Button, buttonVariants } from "@/components/ui/button";
import { InvoiceDeleteConfirmDialog } from "@/components/invoice-delete-confirm-dialog";
import { markInvoiceSentAction } from "@/lib/actions/invoices";
import { formatCents } from "@/lib/format";
import { buildGmailComposeUrl, isGmailUrlTooLong } from "@/lib/invoice/mailto";
import { formatPeriod } from "@/lib/invoice/render";
import { cn } from "@/lib/utils";

export interface InvoiceViewProps {
  invoiceId: number;
  studentName: string;
  parentEmail: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  generatedAt: Date;
  renderedSubject: string;
  renderedBody: string;
  sessionCount: number;
  sent: boolean;
}

// Shared frozen-snapshot view — reused by the post-generate landing (D-09)
// and, in a later plan, History's "open invoice" (D-15/HIST-02). All props
// (including invoiceId/parentEmail/sessionCount, unused by this plan's Copy-
// only action row) are wired now so Plan 03 only edits this component to add
// Email Invoice + Delete Invoice, never the page.
export function InvoiceView(props: InvoiceViewProps) {
  const {
    invoiceId,
    studentName,
    parentEmail,
    periodStart,
    periodEnd,
    totalCents,
    generatedAt,
    renderedSubject,
    renderedBody,
    sessionCount,
    sent: initialSent,
  } = props;

  const [copyLabel, setCopyLabel] = useState("Copy Invoice Text");
  const [copyFailed, setCopyFailed] = useState(false);
  const [sent, setSent] = useState(initialSent);

  // MAIL-01/MAIL-02/D-10: one-click Gmail compose draft, pre-filled with the
  // parent's email, the frozen subject, and the frozen body. MAIL-04 note:
  // parentEmail is guaranteed present (P1 D-13 required+unique) — no
  // no-email guard UI is built (per CONTEXT Deferred Ideas).
  const gmailUrl = buildGmailComposeUrl({
    to: parentEmail,
    subject: renderedSubject,
    body: renderedBody,
  });
  const tooLong = isGmailUrlTooLong(gmailUrl);

  async function handleCopy() {
    try {
      // MAIL-03/D-11: copies the frozen body only (not the subject) — matches
      // how a parent would paste it into an existing email's body field.
      await navigator.clipboard.writeText(renderedBody);
      setCopyFailed(false);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy Invoice Text"), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">
          Invoice — {studentName}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {formatPeriod(periodStart, periodEnd)} · Generated{" "}
          {format(generatedAt, "PPP")} · {formatCents(totalCents)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-zinc-900">
          <span className="font-normal text-zinc-600">Subject: </span>
          {renderedSubject}
        </p>
        {/* Frozen body rendered as a plain auto-escaped text node — never
            raw HTML injection — since notes are parent-facing (D-02) and
            the template is user-authored free text (T-03-07). */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-zinc-900">
          {renderedBody}
        </div>
      </div>

      {tooLong && (
        // Pitfall 5: an over-length Gmail URL doesn't throw or reject — it
        // silently truncates/garbles the draft. Hide the Email anchor
        // entirely rather than open a corrupted compose window; the Copy
        // button below is always present regardless (D-11).
        <p className="text-sm text-zinc-600">
          This invoice is too long for a pre-filled email draft — copy the
          text below and paste it into a new email.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {!tooLong && (
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void markInvoiceSentAction(invoiceId, true);
                setSent(true);
              }}
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-blue-600 text-white hover:bg-blue-700",
              )}
            >
              Email Invoice
            </a>
          )}
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copyLabel}
          </Button>
          {/* Sole delete entry point for an invoice (Surface 4) — not
              duplicated on the History row. */}
          <InvoiceDeleteConfirmDialog
            invoiceId={invoiceId}
            studentName={studentName}
            period={formatPeriod(periodStart, periodEnd)}
            sessionCount={sessionCount}
          />
        </div>

        {/* Mark sent/unsent toggle — shows status and action buttons */}
        <div className="flex items-center gap-3">
          {!sent && (
            <p className="text-sm text-zinc-600">Not sent yet</p>
          )}
          {!sent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void markInvoiceSentAction(invoiceId, true);
                setSent(true);
              }}
            >
              Mark sent
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void markInvoiceSentAction(invoiceId, false);
                setSent(false);
              }}
            >
              Mark unsent
            </Button>
          )}
        </div>
      </div>

      {copyFailed && (
        <div className="flex flex-col gap-2">
          <textarea
            readOnly
            value={renderedBody}
            ref={(el) => el?.select()}
            rows={10}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-relaxed text-zinc-900"
          />
          <p className="text-sm text-zinc-600">
            Select the text above and press Cmd/Ctrl+C to copy.
          </p>
        </div>
      )}
    </div>
  );
}
