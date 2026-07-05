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
import { deleteSessionAction } from "@/lib/actions/sessions";

interface SessionDeleteConfirmDialogProps {
  sessionId: number;
  /** e.g. "1 hr 30 min session for Alex Kim on July 3, 2026" */
  sessionLabel: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

// D-10: delete always shows a confirm dialog first, then hard-deletes
// (unlike ArchiveConfirmDialog's soft archive — this cannot be undone).
export function SessionDeleteConfirmDialog({
  sessionId,
  sessionLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
}: SessionDeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} />}
      >
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this session?</DialogTitle>
        </DialogHeader>
        <p className="text-base text-zinc-600">
          This will permanently remove the {sessionLabel}. This cannot be
          undone.
        </p>
        {/* Bound Server Action: the confirm button submits deleteSessionAction
            with sessionId pre-bound (Next.js arg-bound Server Action pattern),
            no client-side fetch/state plumbing required. */}
        <form
          action={deleteSessionAction.bind(null, sessionId)}
          onSubmit={() => setOpen(false)}
        >
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Keep Session
            </DialogClose>
            <Button
              type="submit"
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete Session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
