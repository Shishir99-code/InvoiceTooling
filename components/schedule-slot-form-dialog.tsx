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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addSlotAction,
  editSlotAction,
  type SlotActionState,
} from "@/lib/actions/schedule";
import type { scheduleSlots } from "@/lib/db/schema";
import { WEEKDAY_OPTIONS } from "@/lib/schedule/format";

type ScheduleSlotRow = typeof scheduleSlots.$inferSelect;

const initialState: SlotActionState = { fieldErrors: null };

// Same hrs(0-8)+min(0/15/30/45) two-Select control as SessionFormDialog —
// combined into a hidden durationMinutes before submit (never a decimal field).
const HOUR_OPTIONS = Array.from({ length: 9 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 15, 30, 45];

interface ScheduleSlotFormDialogBaseProps {
  studentId: number;
  triggerLabel: string;
  triggerClassName?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

type ScheduleSlotFormDialogProps =
  | (ScheduleSlotFormDialogBaseProps & { mode: "add" })
  | (ScheduleSlotFormDialogBaseProps & { mode: "edit"; slot: ScheduleSlotRow });

// Add/Edit weekly slot modal, cloning SessionFormDialog's useActionState +
// "close only on real success" pattern (UI-SPEC Surface 2).
export function ScheduleSlotFormDialog(props: ScheduleSlotFormDialogProps) {
  const isEdit = props.mode === "edit";
  const [state, formAction, isPending] = useActionState(
    isEdit ? editSlotAction : addSlotAction,
    initialState,
  );
  const [open, setOpen] = useState(false);

  const [weekday, setWeekday] = useState<string>(
    String(isEdit ? props.slot.weekday : 1) // default Monday, as string
  );

  const initialHours = isEdit ? Math.floor(props.slot.durationMinutes / 60) : 1;
  const initialMinutes = isEdit ? props.slot.durationMinutes % 60 : 0;
  const [hours, setHours] = useState<string>(String(initialHours));
  const [minutes, setMinutes] = useState<string>(String(initialMinutes));

  // Close the dialog only after a *real* successful submit — same
  // adjust-during-render pattern as SessionFormDialog.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.fieldErrors === null) {
      setOpen(false);
    }
  }

  const title = isEdit ? "Edit weekly slot" : "Add weekly slot";
  const primaryLabel = isEdit ? "Save changes" : "Add slot";
  const pendingLabel = isEdit ? "Saving…" : "Adding…";

  const totalMinutes = Number(hours) * 60 + Number(minutes);

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
        {/* noValidate: server-side zod validation (slotFormSchema) is the sole
            source of truth, mirroring SessionFormDialog. */}
        <form action={formAction} noValidate className="flex flex-col gap-4">
          {isEdit && <input type="hidden" name="id" value={props.slot.id} />}
          <input type="hidden" name="studentId" value={props.studentId} />
          <input type="hidden" name="weekday" value={weekday} />
          <input type="hidden" name="durationMinutes" value={totalMinutes} />

          <div className="flex flex-col gap-2">
            <Label>Day</Label>
            <Select
              value={weekday}
              onValueChange={(value) => value && setWeekday(value)}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value: string) =>
                    WEEKDAY_OPTIONS.find((o) => o.value === Number(value))?.label ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.weekday && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.weekday[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="startTime">Start time</Label>
            <Input
              id="startTime"
              type="time"
              step={900}
              name="startTime"
              defaultValue={isEdit ? props.slot.startTime : ""}
            />
            {state.fieldErrors?.startTime && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.startTime[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Length</Label>
            <div className="flex gap-2">
              <Select
                value={hours}
                onValueChange={(value) => value && setHours(value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {(value: string) => `${value} ${Number(value) === 1 ? "hr" : "hrs"}`}
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
                onValueChange={(value) => value && setMinutes(value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue>{(value: string) => `${value} min`}</SelectValue>
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
            {state.fieldErrors?.durationMinutes && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.durationMinutes[0]}
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
