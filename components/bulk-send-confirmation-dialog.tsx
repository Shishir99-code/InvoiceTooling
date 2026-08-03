"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/format";
import { formatPeriod } from "@/lib/invoice/render";
import { InvoiceHistoryRow } from "./invoice-history-table";

interface BulkSendConfirmationDialogProps {
  isOpen: boolean;
  invoices: InvoiceHistoryRow[];
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Built on the shared Dialog primitive like every other modal here. It was
// previously a bare fixed-position <div>, which meant no dialog role for
// screen readers, no focus trap, and — worst for the one screen that sends
// real email — no Escape to back out.
export function BulkSendConfirmationDialog({
  isOpen,
  invoices,
  isPending,
  onConfirm,
  onCancel,
}: BulkSendConfirmationDialogProps) {
  return (
    <Dialog
      open={isOpen}
      // Ignore dismissals while the send is in flight: emails are already
      // going out and closing would strand the tutor with no result message.
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Send {invoices.length} Invoice{invoices.length === 1 ? "" : "s"}?
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-zinc-600">
          Emails will be sent from your Gmail account to each parent&apos;s
          email on file.
        </p>

        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="text-sm">
              <div className="font-medium text-zinc-900">
                {invoice.studentName}
              </div>
              <div className="text-xs text-zinc-600">{invoice.parentEmail}</div>
              <div className="text-xs text-zinc-600">
                {formatPeriod(invoice.periodStart, invoice.periodEnd)} •{" "}
                {formatCents(invoice.totalCents)}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={onCancel} variant="outline" disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
