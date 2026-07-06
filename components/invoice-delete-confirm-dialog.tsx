"use client";

import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteInvoiceAction } from "@/lib/actions/invoices";

interface InvoiceDeleteConfirmDialogProps {
  invoiceId: number;
  studentName: string;
  period: string;
  sessionCount: number;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

// D-16: the only supported mistake-recovery path — deleting an invoice
// returns its sessions to unbilled. Clones SessionDeleteConfirmDialog
// near-verbatim (same Dialog shell, bound-Server-Action-on-submit pattern,
// trigger-neutral/confirm-red rule). Because deleteInvoiceAction redirects
// server-side, no client-side navigation is needed here.
export function InvoiceDeleteConfirmDialog({
  invoiceId,
  studentName,
  period,
  sessionCount,
  triggerVariant = "outline",
  triggerSize = "sm",
}: InvoiceDeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} />}
      >
        Delete Invoice
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this invoice?</DialogTitle>
        </DialogHeader>
        <p className="text-base text-zinc-600">
          This will permanently delete the invoice for {studentName} (
          {period}) and return its {sessionCount} session(s) to unbilled.
          This cannot be undone.
        </p>
        {/* Bound Server Action: the confirm button submits
            deleteInvoiceAction with invoiceId pre-bound (Next.js arg-bound
            Server Action pattern). The action itself redirects to /history
            server-side, so no onSuccess navigation is wired here. */}
        <form
          action={deleteInvoiceAction.bind(null, invoiceId)}
          onSubmit={() => setOpen(false)}
        >
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Keep Invoice
            </DialogClose>
            <Button
              type="submit"
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete Invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
