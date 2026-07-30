"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  generateInvoiceAction,
  markInvoiceSentAction,
  type InvoiceActionState,
} from "@/lib/actions/invoices";
import type { sessions as sessionsTable } from "@/lib/db/schema";
import { formatCents } from "@/lib/format";
import { buildGmailComposeUrl, isGmailUrlTooLong } from "@/lib/invoice/mailto";
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
  emailDraft: null,
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

  // MAIL-05: after server action succeeds, use gmailUrl state to open Gmail
  // via simple link. Avoids popup/timing issues of pre-opening blank window.
  const [gmailUrl, setGmailUrl] = useState<string | null>(null);

  const [throughDate, setThroughDate] = useState("");

  const sortedSessions = [...sessions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  // Plan 04: filter sessions by optional through-date cutoff (manual generate only).
  // Blank throughDate = no cutoff (all unbilled, default behavior).
  const cutoffSessions = sortedSessions.filter(
    (s) => !throughDate || s.date <= throughDate,
  );

  const totalCents = cutoffSessions.reduce(
    (sum, session) => sum + session.amountCents,
    0,
  );
  const period =
    cutoffSessions.length > 0
      ? formatPeriod(
          cutoffSessions[0].date,
          cutoffSessions[cutoffSessions.length - 1].date,
        )
      : "";
  const invoiceBlock = renderInvoiceText(
    student.name,
    period,
    buildLineItems(cutoffSessions),
  );
  const mergeValues = {
    invoice: invoiceBlock,
    student: student.name,
    total: formatCents(totalCents),
    zelle: settings.zelleHandle,
    period,
  };
  // After successful generation, keep dialog open so user can click Email button.
  // Only close after they navigate away or click the close button.
  const isSuccess = state.fieldErrors === null && state.invoiceId !== null;
  const hasError = state.fieldErrors !== null;

  // generateInvoiceAction revalidates /dashboard, which — since Generate
  // Invoice typically bills everything unbilled — flips this row's `sessions`
  // prop to empty right after success. Recomputing the preview from that
  // live (now-stale) prop would blank out the invoice text while the success
  // buttons are still showing. Once successful, show the server-FROZEN
  // subject/body from emailDraft (what was actually generated) instead.
  const previewSubject =
    isSuccess && state.emailDraft
      ? state.emailDraft.subject
      : renderTemplate(settings.subjectTemplate, mergeValues);
  const previewBody =
    isSuccess && state.emailDraft
      ? state.emailDraft.body
      : renderTemplate(settings.bodyTemplate, mergeValues);

  function handleClose() {
    setOpen(false);
    if (isSuccess) {
      router.push(`/history/${state.invoiceId}`);
    }
  }

  // After successful generation, build and store the Gmail URL (if valid).
  // The Email Invoice link below uses this to open Gmail. Marking the
  // invoice sent happens on the link's own click handler, not here — this
  // effect only builds the URL, it doesn't mean the tutor has actually sent
  // anything yet.
  useEffect(() => {
    if (state.fieldErrors === null && state.invoiceId !== null) {
      const url = state.emailDraft
        ? buildGmailComposeUrl(state.emailDraft)
        : null;
      if (url && !isGmailUrlTooLong(url)) {
        setGmailUrl(url);
      }
    }
  }, [state]);

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

        <form
          action={formAction}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="studentId" value={student.id} />

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-900 mb-1">
                Bill Through Date (Optional)
              </label>
              <Input
                type="date"
                name="throughDate"
                value={throughDate}
                onChange={(e) => setThroughDate(e.target.value)}
              />
              <p className="text-xs text-zinc-600 mt-1">
                Only bill sessions on or before this date. Leave blank to bill
                all unbilled sessions.
              </p>
            </div>
          </div>

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
            {cutoffSessions.length === 0 && (
              <p className="text-sm text-amber-600">
                No unbilled sessions on or before that date.
              </p>
            )}
          </div>

          <DialogFooter>
            {isSuccess && gmailUrl ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  Done
                </Button>
                <a
                  href={gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (state.invoiceId !== null) {
                      void markInvoiceSentAction(state.invoiceId, true);
                    }
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium text-sm"
                >
                  Email Invoice
                </a>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  {isSuccess ? "Done" : "Cancel"}
                </Button>
                {!isSuccess && (
                  <Button
                    type="submit"
                    disabled={isPending || cutoffSessions.length === 0}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {isPending ? "Generating…" : "Generate & Freeze"}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
