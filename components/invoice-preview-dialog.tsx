"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  generateInvoiceAction,
  type InvoiceActionState,
} from "@/lib/actions/invoices";
import type { sessions as sessionsTable } from "@/lib/db/schema";
import { formatCents } from "@/lib/format";
import {
  buildLineItems,
  formatPeriod,
  renderInvoiceText,
  renderTemplate,
} from "@/lib/invoice/render";

type SessionRow = typeof sessionsTable.$inferSelect;

const initialState: InvoiceActionState = {
  fieldErrors: null,
  invoiceId: null,
};

interface InvoicePreviewDialogProps {
  student: { id: number; name: string };
  /** This student's unbilled sessions (any order — sorted ascending here for
   * the preview, mirroring generateInvoiceAction's server-side ordering). */
  sessions: SessionRow[];
  settings: {
    zelleHandle: string;
    subjectTemplate: string;
    bodyTemplate: string;
  };
}

// D-07: preview-then-confirm modal, cloning SessionFormDialog's Dialog shell
// + useActionState + "adjust-during-render, act only on real success"
// pattern. The rendered subject/body shown here is a CLIENT-SIDE,
// non-authoritative preview (mirrors the Log Session "≈ $X.XX" precedent) —
// generateInvoiceAction independently re-fetches unbilled sessions + Settings
// server-side and is the sole source of truth for what actually freezes.
export function InvoicePreviewDialog({
  student,
  sessions,
  settings,
}: InvoicePreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    generateInvoiceAction,
    initialState,
  );

  const sortedSessions = [...sessions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const totalCents = sortedSessions.reduce(
    (sum, session) => sum + session.amountCents,
    0,
  );
  const period =
    sortedSessions.length > 0
      ? formatPeriod(
          sortedSessions[0].date,
          sortedSessions[sortedSessions.length - 1].date,
        )
      : "";
  const invoiceBlock = renderInvoiceText(
    student.name,
    period,
    buildLineItems(sortedSessions),
  );
  const mergeValues = {
    invoice: invoiceBlock,
    student: student.name,
    total: formatCents(totalCents),
    zelle: settings.zelleHandle,
    period,
  };
  const previewSubject = renderTemplate(settings.subjectTemplate, mergeValues);
  const previewBody = renderTemplate(settings.bodyTemplate, mergeValues);

  // Close + navigate only after a *real* successful submit — same
  // adjust-during-render idiom as SessionFormDialog (D-16 precedent), but
  // navigates to the finished invoice (D-09) instead of just closing.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.fieldErrors === null && state.invoiceId !== null) {
      setOpen(false);
      router.push(`/history/${state.invoiceId}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        Generate Invoice
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Invoice for {student.name}</DialogTitle>
          <DialogDescription>
            Review the invoice below. Generating will freeze this exact text
            and mark these sessions as billed — this cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studentId" value={student.id} />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-zinc-900">
              <span className="font-normal text-zinc-600">Subject: </span>
              {previewSubject}
            </p>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-zinc-900">
              {previewBody}
            </div>
            {state.fieldErrors?.studentId && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.studentId[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? "Generating…" : "Generate & Freeze"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
