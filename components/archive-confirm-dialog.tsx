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
import { archiveStudentAction } from "@/lib/actions/students";

interface ArchiveConfirmDialogProps {
  studentId: number;
  studentName: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

// D-12: archiving always shows a confirm dialog first. Dismissing ("Keep on
// Roster") performs no write; only the destructive-red "Archive Student"
// button invokes archiveStudentAction.
export function ArchiveConfirmDialog({
  studentId,
  studentName,
  triggerVariant = "outline",
  triggerSize = "sm",
}: ArchiveConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} />}
      >
        Archive
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {studentName}?</DialogTitle>
        </DialogHeader>
        <p className="text-base text-zinc-600">
          {studentName} will be removed from your active roster. You can
          restore them anytime from Archived Students.
        </p>
        {/* Bound Server Action: the confirm button submits archiveStudentAction
            with studentId pre-bound (Next.js arg-bound Server Action pattern),
            no client-side fetch/state plumbing required. */}
        <form
          action={archiveStudentAction.bind(null, studentId)}
          onSubmit={() => setOpen(false)}
        >
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Keep on Roster
            </DialogClose>
            <Button
              type="submit"
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Archive Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
