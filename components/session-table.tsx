"use client";

import { type ReactNode, useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";

import { AutoLoggedMarker } from "@/components/auto-logged-marker";
import { SessionDeleteConfirmDialog } from "@/components/session-delete-confirm-dialog";
import { SessionFormDialog } from "@/components/session-form-dialog";
import type { StudentComboboxOption } from "@/components/student-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { sessions } from "@/lib/db/schema";
import { formatCents, formatDuration } from "@/lib/format";

type SessionRow = typeof sessions.$inferSelect;

// MK-01: internal-only marker for a rescheduled class. Deliberately quiet —
// it sits alongside the date without competing with the amount, and never
// reaches the invoice a parent receives.
function MakeupBadge() {
  return (
    <span
      title="Makeup session — internal note, not shown on invoices"
      className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700"
    >
      Makeup
    </span>
  );
}

export interface SessionGroup {
  studentId: number;
  studentName: string;
  /** RESEARCH.md Open Question 2: archived students' history is preserved
   * and marked with a small badge rather than hidden. */
  archived: boolean;
  sessions: SessionRow[];
}

interface SessionTableProps {
  groups: SessionGroup[];
  students: StudentComboboxOption[];
  /** Rendered inside the full-page empty state (mirrors StudentTable's
   * emptyState.action convention — D-15 friendly empty-state pattern). */
  emptyStateAction?: ReactNode;
}

function formatSessionDate(date: string) {
  // Pitfall 2: never round-trip the *stored* date through a JS Date for
  // storage — this transient conversion is display-only.
  return format(new Date(`${date}T00:00:00`), "PPP");
}

// D-08: sessions grouped by student, collapsed by default. Reuses
// StudentTable's exact responsive table (md+) / stacked-card (mobile) split
// inside each expanded group.
export function SessionTable({
  groups,
  students,
  emptyStateAction,
}: SessionTableProps) {
  const totalSessions = groups.reduce((sum, g) => sum + g.sessions.length, 0);

  if (totalSessions === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <h2 className="text-xl leading-tight font-semibold text-zinc-900">
          No sessions yet
        </h2>
        <p className="text-base text-zinc-600">
          Log your first session to start tracking hours.
        </p>
        {emptyStateAction}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <SessionGroupRow key={group.studentId} group={group} students={students} />
      ))}
    </div>
  );
}

function SessionGroupRow({
  group,
  students,
}: {
  group: SessionGroup;
  students: StudentComboboxOption[];
}) {
  const [open, setOpen] = useState(false);

  const unbilledTotalCents = group.sessions
    .filter((s) => !s.billed)
    .reduce((sum, s) => sum + s.amountCents, 0);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      {/* Group header row (accordion trigger) — 44px min tap target
          (spacing exception) per UI-SPEC Surface 3. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            className={`size-4 shrink-0 text-zinc-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
          <span className="text-base font-medium text-zinc-900">
            {group.studentName}
          </span>
          {group.archived && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              Archived
            </span>
          )}
          <span className="text-sm text-zinc-600">
            {group.sessions.length}{" "}
            {group.sessions.length === 1 ? "session" : "sessions"}
          </span>
        </span>
        <span className="text-base text-zinc-900">
          {formatCents(unbilledTotalCents)}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-200 p-4">
          {group.sessions.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No sessions logged for {group.studentName} yet.
            </p>
          ) : (
            <>
              {/* md+ breakpoint: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Length</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {session.scheduleSlotId !== null && (
                              <AutoLoggedMarker />
                            )}
                            {formatSessionDate(session.date)}
                            {session.makeup && <MakeupBadge />}
                          </span>
                        </TableCell>
                        <TableCell>
                          {formatDuration(session.durationMinutes)}
                        </TableCell>
                        <TableCell>{formatCents(session.amountCents)}</TableCell>
                        <TableCell className="whitespace-normal">
                          {session.notes ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <SessionFormDialog
                              mode="edit"
                              session={session}
                              students={students}
                              triggerLabel="Edit"
                              triggerVariant="outline"
                              triggerSize="sm"
                            />
                            <SessionDeleteConfirmDialog
                              sessionId={session.id}
                              sessionLabel={`${formatDuration(session.durationMinutes)} session for ${group.studentName} on ${formatSessionDate(session.date)}`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Below md: stacked cards (D-14 mobile-friendly pattern) */}
              <div className="flex flex-col gap-3 md:hidden">
                {group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-base font-medium text-zinc-900">
                        {session.scheduleSlotId !== null && (
                          <AutoLoggedMarker />
                        )}
                        {formatSessionDate(session.date)}
                      </span>
                      <div className="flex gap-2">
                        <SessionFormDialog
                          mode="edit"
                          session={session}
                          students={students}
                          triggerLabel="Edit"
                          triggerVariant="outline"
                          triggerSize="sm"
                        />
                        <SessionDeleteConfirmDialog
                          sessionId={session.id}
                          sessionLabel={`${formatDuration(session.durationMinutes)} session for ${group.studentName} on ${formatSessionDate(session.date)}`}
                        />
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-base text-zinc-600">
                      {formatDuration(session.durationMinutes)} ·{" "}
                      {formatCents(session.amountCents)}
                      {session.makeup && <MakeupBadge />}
                    </span>
                    {session.notes && (
                      <span className="text-base text-zinc-600">
                        {session.notes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
