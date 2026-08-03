"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  bulkConfirmOccurrencesAction,
  confirmOccurrenceAction,
  dismissOccurrenceAction,
  restoreOccurrenceAction,
  type ConfirmOccurrenceState,
} from "@/lib/actions/calendar";
import { formatCents } from "@/lib/format";
import { weekdayOf } from "@/lib/schedule/time";
import { cn } from "@/lib/utils";

export interface LoggedChip {
  id: number;
  studentName: string;
  durationMinutes: number;
}

export interface OccurrenceChip {
  slotId: number;
  date: string;
  studentName: string;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  rateCents: number;
}

export interface CalendarDay {
  date: string;
  logged: LoggedChip[];
  pending: OccurrenceChip[];
  upcoming: OccurrenceChip[];
  dismissed: OccurrenceChip[]; // DISM-01: discarded — shown struck-through, click to restore
}

interface CalendarViewProps {
  monthLabel: string;
  prevMonth: string; // "YYYY-MM"
  nextMonth: string;
  today: string; // "yyyy-MM-dd"
  days: CalendarDay[];
  hasSlots: boolean;
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// D-05 duration options, matching SessionFormDialog.
const HOUR_OPTIONS = Array.from({ length: 9 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 15, 30, 45];

const initialConfirmState: ConfirmOccurrenceState = { fieldErrors: null };

// "HH:mm" → "3:30 PM"
function formatStartTime(startTime: string): string {
  const [h24, min] = startTime.split(":").map(Number);
  const meridiem = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${meridiem}`;
}

function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

// CAL-01: month-grid calendar. Everything shown is derived live — logged
// sessions are real rows; pending/upcoming chips are computed occurrences of
// the weekly schedule and only become sessions when confirmed here.
export function CalendarView({
  monthLabel,
  prevMonth,
  nextMonth,
  today,
  days,
  hasSlots,
}: CalendarViewProps) {
  const [selected, setSelected] = useState<OccurrenceChip | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();
  const [isRestoring, startRestoreTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const allPending = days.flatMap((d) => d.pending);

  const handleBulkConfirm = () => {
    startBulkTransition(async () => {
      const result = await bulkConfirmOccurrencesAction(
        allPending.map(({ slotId, date }) => ({ slotId, date })),
      );
      setBulkOpen(false);
      setResultMessage(
        result.ok
          ? `Logged ${result.logged} session${result.logged === 1 ? "" : "s"}${
              result.skipped > 0 ? `, ${result.skipped} skipped` : ""
            }.`
          : (result.error ?? "Could not log sessions."),
      );
    });
  };

  // DISM-01: clicking a struck-through chip undoes the discard. Kept separate
  // from the confirm dialog — restoring is a single reversible click, so it
  // doesn't warrant a confirmation step.
  const handleRestore = (chip: OccurrenceChip) => {
    startRestoreTransition(async () => {
      const result = await restoreOccurrenceAction(chip.slotId, chip.date);
      setResultMessage(
        result.ok
          ? `Restored ${chip.studentName}'s class — it's pending again.`
          : (result.error ?? "Could not restore that class."),
      );
    });
  };

  // Leading blanks so day 1 lands under its weekday column.
  const leadingBlanks = days.length > 0 ? weekdayOf(days[0].date) : 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">
          {monthLabel}
        </h1>
        <div className="flex items-center gap-2">
          {allPending.length > 0 && (
            <Button
              onClick={() => setBulkOpen(true)}
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Log all pending ({allPending.length})
            </Button>
          )}
          <Link
            href={`/calendar?month=${prevMonth}`}
            aria-label="Previous month"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ←
          </Link>
          <Link
            href={`/calendar?month=${nextMonth}`}
            aria-label="Next month"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            →
          </Link>
        </div>
      </div>

      {resultMessage && (
        <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          {resultMessage}
        </div>
      )}

      {!hasSlots && (
        <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          No weekly schedules yet. Add a weekly schedule to a student to see
          their classes here — logged sessions still show on their dates.
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-7 border-b border-zinc-200 pb-2">
            {WEEKDAY_HEADERS.map((label) => (
              <div
                key={label}
                className="text-center text-xs font-medium text-zinc-500"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px rounded-b-lg bg-zinc-200">
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`blank-${i}`} className="min-h-24 bg-zinc-50" />
            ))}
            {days.map((day) => {
              const isToday = day.date === today;
              const dayNumber = Number(day.date.slice(8));
              return (
                <div
                  key={day.date}
                  className="flex min-h-24 flex-col gap-1 bg-white p-1.5"
                >
                  <span
                    className={cn(
                      "self-start text-xs",
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 font-semibold text-white"
                        : "text-zinc-500",
                    )}
                  >
                    {dayNumber}
                  </span>

                  {day.logged.map((chip) => (
                    <span
                      key={`logged-${chip.id}`}
                      title={`${chip.studentName} · ${chip.durationMinutes} min · logged`}
                      className="truncate rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800"
                    >
                      ✓ {firstName(chip.studentName)}
                    </span>
                  ))}

                  {day.pending.map((chip) => (
                    <button
                      key={`pending-${chip.slotId}`}
                      type="button"
                      onClick={() => setSelected(chip)}
                      title={`${chip.studentName} · ${formatStartTime(chip.startTime)} · tap to log`}
                      className="truncate rounded border border-dashed border-amber-400 bg-amber-50 px-1.5 py-0.5 text-left text-xs text-amber-800 hover:bg-amber-100"
                    >
                      {firstName(chip.studentName)}
                    </button>
                  ))}

                  {day.upcoming.map((chip) => (
                    <span
                      key={`upcoming-${chip.slotId}`}
                      title={`${chip.studentName} · ${formatStartTime(chip.startTime)} · upcoming`}
                      className="truncate rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500"
                    >
                      {firstName(chip.studentName)}
                    </span>
                  ))}

                  {day.dismissed.map((chip) => (
                    <button
                      key={`dismissed-${chip.slotId}`}
                      type="button"
                      onClick={() => handleRestore(chip)}
                      disabled={isRestoring}
                      title={`${chip.studentName} · ${formatStartTime(chip.startTime)} · discarded — click to restore`}
                      className="truncate rounded px-1.5 py-0.5 text-left text-xs text-zinc-400 line-through hover:bg-zinc-50 hover:text-zinc-600 disabled:opacity-50"
                    >
                      {firstName(chip.studentName)}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-green-100 ring-1 ring-green-300" />
          Logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-dashed border-amber-400 bg-amber-50" />
          Pending — tap to log
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-zinc-100 ring-1 ring-zinc-300" />
          Upcoming
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-zinc-400 line-through">Abc</span>
          Discarded — click to restore
        </span>
      </div>

      {selected && (
        <ConfirmOccurrenceDialog
          key={`${selected.slotId}:${selected.date}`}
          chip={selected}
          onClose={() => setSelected(null)}
          onResult={setResultMessage}
        />
      )}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log all pending sessions?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            This logs {allPending.length} session
            {allPending.length === 1 ? "" : "s"} shown as pending this month,
            each with its scheduled length. You can edit or delete any of them
            afterwards from the Sessions tab.
          </p>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleBulkConfirm}
              disabled={isBulkPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isBulkPending ? "Logging…" : `Log ${allPending.length} sessions`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Single-occurrence confirm dialog: prefilled from the slot, duration/notes
// editable before saving (clones SessionFormDialog's useActionState +
// close-only-on-real-success pattern).
function ConfirmOccurrenceDialog({
  chip,
  onClose,
  onResult,
}: {
  chip: OccurrenceChip;
  onClose: () => void;
  onResult: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState(
    confirmOccurrenceAction,
    initialConfirmState,
  );

  const [hours, setHours] = useState<number>(
    Math.floor(chip.durationMinutes / 60),
  );
  const [minutes, setMinutes] = useState<number>(chip.durationMinutes % 60);

  // Close on real success only. Unlike SessionFormDialog's local `setOpen`,
  // onClose() here reaches up into the PARENT's state (CalendarView's
  // `selected`) — updating another component's state during this
  // component's render is unsafe (React warns), so the close has to happen
  // in an effect. Two StrictMode-dev pitfalls to avoid here:
  //   1. onClose is a fresh inline function on every CalendarView render, so
  //      it's read via a ref rather than listed as a dependency — depending
  //      on it would re-fire this effect (and close the dialog) on any
  //      unrelated parent re-render.
  //   2. A mutable "isFirstRender" ref does NOT reliably skip the initial
  //      run — dev StrictMode intentionally double-invokes a fresh effect
  //      (setup → cleanup → setup again) on the SAME instance, and the
  //      ref's mutation survives that replay, so the second invocation would
  //      wrongly see "already ran" and fire early. Comparing against the
  //      module-level `initialConfirmState` object identity instead is
  //      replay-safe: it's only unequal after a REAL useActionState dispatch
  //      returns a new state object, however many times the effect runs.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (state !== initialConfirmState && state.fieldErrors === null) {
      onCloseRef.current();
    }
  }, [state]);

  const [isDismissing, startDismissTransition] = useTransition();

  // Discard = "this class did not happen". Writes a dismissal row so the
  // pending chip stops coming back on every render, then closes. No session is
  // created, so nothing becomes billable.
  const handleDismiss = () => {
    startDismissTransition(async () => {
      const result = await dismissOccurrenceAction(chip.slotId, chip.date);
      onResult(
        result.ok
          ? `Discarded ${chip.studentName}'s class — click the struck-through name to undo.`
          : (result.error ?? "Could not discard that class."),
      );
      if (result.ok) onCloseRef.current();
    });
  };

  const totalMinutes = hours * 60 + minutes;
  // Client-side preview only — the Server Action recomputes from the live rate.
  const previewAmountCents = Math.round((totalMinutes * chip.rateCents) / 60);

  const dateLabel = new Date(`${chip.date}T00:00:00`).toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Session</DialogTitle>
        </DialogHeader>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="slotId" value={chip.slotId} />
          <input type="hidden" name="date" value={chip.date} />
          <input type="hidden" name="durationMinutes" value={totalMinutes} />

          <p className="text-sm text-zinc-600">
            {chip.studentName} · {dateLabel} ·{" "}
            {formatStartTime(chip.startTime)}
          </p>

          {state.fieldErrors?._form && (
            <p className="text-sm text-red-600">{state.fieldErrors._form[0]}</p>
          )}

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
            <p className="text-sm text-zinc-600">
              ≈ {formatCents(previewAmountCents)}
            </p>
            {state.fieldErrors?.durationMinutes && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.durationMinutes[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`notes-${chip.slotId}-${chip.date}`}>
              Notes (optional)
            </Label>
            <p className="text-sm text-zinc-600">
              Notes appear on invoices sent to parents.
            </p>
            <Textarea
              id={`notes-${chip.slotId}-${chip.date}`}
              name="notes"
              rows={3}
              placeholder="Add any notes about this session (optional)"
            />
            {state.fieldErrors?.notes && (
              <p className="text-sm text-red-600">
                {state.fieldErrors.notes[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            {/* Three distinct outcomes, so three buttons: back out and change
                nothing (Cancel), record that the class did not happen
                (Discard — removes the pending chip for good), or log it. */}
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isDismissing}
              onClick={handleDismiss}
            >
              {isDismissing ? "Discarding…" : "Discard"}
            </Button>
            <Button
              type="submit"
              disabled={isPending || isDismissing}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? "Logging…" : "Log Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
