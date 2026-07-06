"use client";

import { useState, type ComponentProps } from "react";

import { ScheduleSlotFormDialog } from "@/components/schedule-slot-form-dialog";
import { SlotRemoveConfirmDialog } from "@/components/slot-remove-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { scheduleSlots } from "@/lib/db/schema";
import { formatSlotLabel } from "@/lib/schedule/format";

type ScheduleSlotRow = typeof scheduleSlots.$inferSelect;

interface WeeklyScheduleDialogProps {
  studentId: number;
  studentName: string;
  slots: ScheduleSlotRow[];
  triggerLabel: string;
  triggerClassName?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

// UI-SPEC Surface 1: per-student weekly schedule manager. Lists slots via
// formatSlotLabel with Edit + Remove per row, an Add slot CTA, and an empty
// state. Reuses existing shadcn blocks only (Registry Safety).
export function WeeklyScheduleDialog({
  studentId,
  studentName,
  slots,
  triggerLabel,
  triggerClassName,
  triggerVariant,
  triggerSize,
}: WeeklyScheduleDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClassName}
          />
        }
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{studentName} — Weekly schedule</DialogTitle>
        </DialogHeader>

        {slots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <h2 className="text-lg leading-tight font-semibold text-zinc-900">
              No weekly classes yet
            </h2>
            <p className="text-base text-zinc-600">
              Add a recurring slot and sessions log themselves each week.
            </p>
            <ScheduleSlotFormDialog
              studentId={studentId}
              mode="add"
              triggerLabel="Add slot"
              triggerClassName="mt-4 bg-blue-600 text-white hover:bg-blue-700"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex min-h-11 items-center justify-between gap-2"
                >
                  <span className="text-base text-zinc-900">
                    {formatSlotLabel(
                      slot.weekday,
                      slot.startTime,
                      slot.durationMinutes,
                    )}
                  </span>
                  <div className="flex gap-2">
                    <ScheduleSlotFormDialog
                      studentId={studentId}
                      mode="edit"
                      slot={slot}
                      triggerLabel="Edit"
                      triggerVariant="outline"
                      triggerSize="sm"
                    />
                    <SlotRemoveConfirmDialog slotId={slot.id} />
                  </div>
                </div>
              ))}
            </div>
            <ScheduleSlotFormDialog
              studentId={studentId}
              mode="add"
              triggerLabel="Add slot"
              triggerClassName="w-full bg-blue-600 text-white hover:bg-blue-700"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
