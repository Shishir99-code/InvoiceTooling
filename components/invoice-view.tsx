"use client";

import { useState } from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/format";
import { formatPeriod } from "@/lib/invoice/render";

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
}

// Shared frozen-snapshot view — reused by the post-generate landing (D-09)
// and, in a later plan, History's "open invoice" (D-15/HIST-02). All props
// (including invoiceId/parentEmail/sessionCount, unused by this plan's Copy-
// only action row) are wired now so Plan 03 only edits this component to add
// Email Invoice + Delete Invoice, never the page.
export function InvoiceView(props: InvoiceViewProps) {
  const {
    studentName,
    periodStart,
    periodEnd,
    totalCents,
    generatedAt,
    renderedSubject,
    renderedBody,
  } = props;

  const [copyLabel, setCopyLabel] = useState("Copy Invoice Text");
  const [copyFailed, setCopyFailed] = useState(false);

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

      <div className="flex gap-2">
        {/* Email Invoice + Delete Invoice added in Plan 03 */}
        <Button type="button" variant="outline" onClick={handleCopy}>
          {copyLabel}
        </Button>
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
