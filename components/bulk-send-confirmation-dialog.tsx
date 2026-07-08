"use client";

import { Button } from "@/components/ui/button";
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

export function BulkSendConfirmationDialog({
  isOpen,
  invoices,
  isPending,
  onConfirm,
  onCancel,
}: BulkSendConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-zinc-900">
          Send {invoices.length} Invoice{invoices.length === 1 ? "" : "s"}?
        </h2>

        <p className="mt-2 text-sm text-zinc-600">
          Emails will be sent from your Gmail account to each parent's email on file.
        </p>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="text-sm">
              <div className="font-medium text-zinc-900">{invoice.studentName}</div>
              <div className="text-xs text-zinc-600">
                {invoice.parentEmail}
              </div>
              <div className="text-xs text-zinc-600">
                {formatPeriod(invoice.periodStart, invoice.periodEnd)} •{" "}
                {formatCents(invoice.totalCents)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
