"use client";

import { useEffect, useRef, useState } from "react";
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

  // MAIL-05 (RESEARCH §1): grab a blank window handle SYNCHRONOUSLY inside the
  // click gesture so the browser trusts it as user-initiated (not a blocked
  // pop-up). The Server Action then resolves and we point this handle at the
  // Gmail compose URL. handleSubmit must NOT preventDefault — that would cancel
  // the Server Action submission.
  const popupRef = useRef<Window | null>(null);
  function handleSubmit() {
    popupRef.current = window.open("", "_blank");
  }

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
  const previewSubject = renderTemplate(settings.subjectTemplate, mergeValues);
  const previewBody = renderTemplate(settings.bodyTemplate, mergeValues);

  // Close + navigate only after a *real* successful submit — same
  // adjust-during-render idiom as SessionFormDialog (D-16 precedent), but
  // navigates to the finished invoice (D-09) instead of just closing. The
  // window-handle side effect lives in the effect below (refs may not be
  // touched during render — react-hooks/refs).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.fieldErrors === null && state.invoiceId !== null) {
      setOpen(false);
      router.push(`/history/${state.invoiceId}`);
    }
  }

  // Point the pre-opened blank tab at the Gmail draft once the action resolves.
  // The handle was grabbed synchronously in handleSubmit (inside the click
  // gesture) so it is not treated as a blocked pop-up; here we only redirect or
  // close it based on the result.
  useEffect(() => {
    if (state.fieldErrors === null && state.invoiceId !== null) {
      // Success: open the draft (D-01) UNLESS the URL is over-length (D-03),
      // the draft is missing, or the handle was blocked/null — then close the
      // handle so no empty tab is orphaned and /history's copy-first UI takes
      // over.
      const gmailUrl = state.emailDraft
        ? buildGmailComposeUrl(state.emailDraft)
        : null;
      if (gmailUrl && !isGmailUrlTooLong(gmailUrl) && popupRef.current) {
        popupRef.current.location.href = gmailUrl;
      } else {
        popupRef.current?.close();
      }
      popupRef.current = null;
    } else if (state.fieldErrors !== null) {
      // Error: clean up any pre-opened blank tab (the dialog stays open).
      popupRef.current?.close();
      popupRef.current = null;
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
          onSubmit={handleSubmit}
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
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={isPending || cutoffSessions.length === 0}
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
