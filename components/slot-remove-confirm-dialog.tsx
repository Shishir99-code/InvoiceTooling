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
import { deleteSlotAction } from "@/lib/actions/schedule";

interface SlotRemoveConfirmDialogProps {
  slotId: number;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

// D-06: removing a slot only stops FUTURE auto-logging — sessions already
// logged from it stay. The reassurance copy prevents a mis-tap from reading as
// "delete history". Clones SessionDeleteConfirmDialog's bound-action pattern.
export function SlotRemoveConfirmDialog({
  slotId,
  triggerVariant = "outline",
  triggerSize = "sm",
}: SlotRemoveConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} />}
      >
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this weekly slot?</DialogTitle>
        </DialogHeader>
        <p className="text-base text-zinc-600">
          Sessions already logged from it stay. Only future auto-logging stops.
        </p>
        <form
          action={deleteSlotAction.bind(null, slotId)}
          onSubmit={() => setOpen(false)}
        >
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Keep slot
            </DialogClose>
            <Button
              type="submit"
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Remove
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
