"use client";

import { useState, type ComponentProps } from "react";
import { useActionState } from "react";
import { format } from "date-fns";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/date-picker-field";
import {
  StudentCombobox,
  type StudentComboboxOption,
} from "@/components/student-combobox";
import {
  addSessionAction,
  editSessionAction,
  type SessionActionState,
} from "@/lib/actions/sessions";
import type { sessions } from "@/lib/db/schema";
import { formatCents } from "@/lib/format";

type SessionRow = typeof sessions.$inferSelect;

const initialState: SessionActionState = { fieldErrors: null };

// D-05: hours 0-8, minutes in 15-min increments — combined into a single
// hidden `durationMinutes` input before submit (never a raw decimal field).
const HOUR_OPTIONS = Array.from({ length: 9 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 15, 30, 45];

interface SessionFormDialogBaseProps {
  students: StudentComboboxOption[];
  triggerLabel: string;
  triggerClassName?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

type SessionFormDialogProps =
  | (SessionFormDialogBaseProps & { mode: "add" })
  | (SessionFormDialogBaseProps & { mode: "edit"; session: SessionRow });

// D-03/D-09: Log Session (add) / Edit Session (edit) modal, cloning
// StudentFormDialog's useActionState + "close only on real success" pattern.
export function SessionFormDialog(props: SessionFormDialogProps) {
  const isEdit = props.mode === "edit";
  const [state, formAction, isPending] = useActionState(
    isEdit ? editSessionAction : addSessionAction,
    initialState,
  );
  const [open, setOpen] = useState(false);

  const initialStudent = isEdit
    ? (props.students.find((s) => s.id === props.session.studentId) ?? null)
    : null;
  const [selectedStudent, setSelectedStudent] =
    useState<StudentComboboxOption | null>(initialStudent);

  // Pitfall 2: the stored `date` column is a plain "yyyy-MM-dd" string —
  // only converted to a JS Date transiently for the Calendar UI, formatted
  // straight back to a string before submission.
  const initialDate = isEdit
    ? new Date(`${props.session.date}T00:00:00`)
    : new Date();
  const [date, setDate] = useState<Date>(initialDate);

  const initialHours = isEdit
    ? Math.floor(props.session.durationMinutes / 60)
    : 0;
  const initialMinutes = isEdit ? props.session.durationMinutes % 60 : 0;
  const [hours, setHours] = useState<number>(initialHours);
  const [minutes, setMinutes] = useState<number>(initialMinutes);

  // Close the dialog only after a *real* successful submit — same
  // adjust-during-render pattern as StudentFormDialog (D-16 precedent).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.fieldErrors === null) {
      setOpen(false);
    }
  }

  const fieldSuffix = isEdit ? String(props.session.id) : "new";
  const title = isEdit ? "Edit Session" : "Log Session";
  const primaryLabel = isEdit ? "Save Changes" : "Log Session";
  const pendingLabel = isEdit ? "Saving…" : "Logging…";

  const totalMinutes = hours * 60 + minutes;
  // Non-authoritative client-side estimate only — never submitted as form
  // data. The Server Action independently re-fetches rateCents and computes
  // the real amountCents (Pitfall 1 still fully applies).
  const previewAmountCents = selectedStudent
    ? Math.round((totalMinutes * selectedStudent.rateCents) / 60)
    : null;

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
        {/* noValidate: server-side zod validation is the sole source of
            truth, mirroring StudentFormDialog's D-16 precedent. */}
        <form action={formAction} noValidate className="flex flex-col gap-4">
          {isEdit && (
            <input type="hidden" name="id" value={props.session.id} />
          )}
          <input
            type="hidden"
            name="studentId"
            value={selectedStudent?.id ?? ""}
          />
          <input type="hidden" name="durationMinutes" value={totalMinutes} />
          <input type="hidden" name="date" value={format(date, "yyyy-MM-dd")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor={`student-${fieldSuffix}`}>Student</Label>
            <StudentCombobox
              students={props.students}
              value={selectedStudent}
              onValueChange={setSelectedStudent}
            />
            {state.fieldErrors?.studentId && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.studentId[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Length</Label>
            <div className="flex gap-2">
              <Select
                value={hours}
                onValueChange={(value) => setHours(value as number)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {(value: number) => `${value} ${value === 1 ? "hr" : "hrs"}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h} {h === 1 ? "hr" : "hrs"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={minutes}
                onValueChange={(value) => setMinutes(value as number)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue>{(value: number) => `${value} min`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedStudent && previewAmountCents !== null && (
              <p className="text-sm text-zinc-600">
                ≈ {formatCents(previewAmountCents)}
              </p>
            )}
            {state.fieldErrors?.durationMinutes && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.durationMinutes[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Date</Label>
            <DatePickerField value={date} onChange={setDate} />
            {state.fieldErrors?.date && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.date[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`notes-${fieldSuffix}`}>Notes (optional)</Label>
            <p className="text-sm text-zinc-600">
              Notes appear on invoices sent to parents.
            </p>
            <Textarea
              id={`notes-${fieldSuffix}`}
              name="notes"
              rows={3}
              placeholder="Add any notes about this session (optional)"
              defaultValue={isEdit ? (props.session.notes ?? "") : ""}
            />
            {state.fieldErrors?.notes && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.notes[0]}
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
