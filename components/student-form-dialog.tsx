"use client";

import { useState, type ComponentProps } from "react";
import { useActionState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addStudentAction,
  editStudentAction,
  type StudentActionState,
} from "@/lib/actions/students";
import type { students } from "@/lib/db/schema";

type Student = typeof students.$inferSelect;

const initialState: StudentActionState = { fieldErrors: null };

interface StudentFormDialogBaseProps {
  triggerLabel: string;
  triggerClassName?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

type StudentFormDialogProps =
  | (StudentFormDialogBaseProps & { mode: "add" })
  | (StudentFormDialogBaseProps & { mode: "edit"; student: Student });

export function StudentFormDialog(props: StudentFormDialogProps) {
  const isEdit = props.mode === "edit";
  const [state, formAction, isPending] = useActionState(
    isEdit ? editStudentAction : addStudentAction,
    initialState,
  );
  const [open, setOpen] = useState(false);

  // Close the dialog only after a *real* successful submit. `state` is a
  // fresh object on every action resolution, so tracking the previously-seen
  // reference (adjusted during render, not in an Effect — React's documented
  // pattern for "state changed, react to it" without a cascading-render
  // Effect) distinguishes "just mounted" from "submitted and the server
  // returned no field errors" (D-16: invalid submits keep the dialog open).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.fieldErrors === null) {
      setOpen(false);
    }
  }

  const fieldSuffix = isEdit ? String(props.student.id) : "new";
  const title = isEdit ? "Edit Student" : "Add Student";
  const primaryLabel = isEdit ? "Save Changes" : "Add Student";
  const pendingLabel = isEdit ? "Saving…" : "Adding…";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={props.triggerVariant}
            size={props.triggerSize}
            className={props.triggerClassName}
          />
        }
      >
        {props.triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* noValidate: server-side zod validation (D-16) is the sole source
            of truth. Without this, the browser's native type="email"
            constraint validation intercepts malformed input and blocks
            submission before our custom "Enter a valid email." message
            (or the server round-trip) ever runs — found via live
            end-to-end testing. */}
        <form
          action={formAction}
          noValidate
          className="flex flex-col gap-4"
        >
          {isEdit && (
            <input type="hidden" name="id" value={props.student.id} />
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`name-${fieldSuffix}`}>Name</Label>
            <Input
              id={`name-${fieldSuffix}`}
              name="name"
              defaultValue={isEdit ? props.student.name : ""}
              required
            />
            {state.fieldErrors?.name && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`rate-${fieldSuffix}`}>Hourly Rate</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-base text-zinc-500">
                $
              </span>
              <Input
                id={`rate-${fieldSuffix}`}
                name="rateDollars"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={
                  isEdit ? (props.student.rateCents / 100).toFixed(2) : ""
                }
                className="pl-6"
                required
              />
            </div>
            {state.fieldErrors?.rateDollars && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.rateDollars[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`email-${fieldSuffix}`}>Parent Email</Label>
            <Input
              id={`email-${fieldSuffix}`}
              name="parentEmail"
              type="email"
              defaultValue={isEdit ? props.student.parentEmail : ""}
              required
            />
            {state.fieldErrors?.parentEmail && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.parentEmail[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`zoom-${fieldSuffix}`}>Zoom Link (optional)</Label>
            <Input
              id={`zoom-${fieldSuffix}`}
              name="zoomLink"
              type="url"
              defaultValue={isEdit ? (props.student.zoomLink ?? "") : ""}
            />
            {state.fieldErrors?.zoomLink && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.zoomLink[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Discard
            </DialogClose>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? pendingLabel : primaryLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
