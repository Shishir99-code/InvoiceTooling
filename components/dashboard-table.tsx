"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";

import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";
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

export interface DashboardRow {
  id: number;
  name: string;
  unbilledMinutes: number;
  unbilledAmountCents: number;
}

interface DashboardSettings {
  zelleHandle: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

interface DashboardTableProps {
  /** Pre-sorted by the server (most-owed first, alpha tiebreak) — never
   * re-sorted client-side. */
  rows: DashboardRow[];
  /** Unbilled sessions only, keyed by studentId (D-13 — never billed rows). */
  sessionsByStudentId: Record<number, SessionRow[]>;
  /** Active student list, for the expanded-row Edit dialog's combobox. */
  students: StudentComboboxOption[];
  /** Zelle handle + email templates, threaded down for the Generate Invoice
   * preview modal (D-07) — read once on the server, never re-fetched here. */
  settings: DashboardSettings;
}

function formatSessionDate(date: string) {
  // Pitfall 2: never round-trip the *stored* date through a JS Date for
  // storage — this transient conversion is display-only.
  return format(new Date(`${date}T00:00:00`), "PPP");
}

// D-11/D-12/D-13: every active student, sorted most-owed-first, $0 students
// de-emphasized (never hidden), expandable to their unbilled sessions with a
// path to edit. Mirrors SessionTable's collapsible-group affordance.
export function DashboardTable({
  rows,
  sessionsByStudentId,
  students,
  settings,
}: DashboardTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <h2 className="text-xl leading-tight font-semibold text-zinc-900">
          No active students yet
        </h2>
        <p className="text-base text-zinc-600">
          Add a student to start tracking who owes what.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <DashboardRowItem
          key={row.id}
          row={row}
          sessions={sessionsByStudentId[row.id] ?? []}
          students={students}
          settings={settings}
        />
      ))}
    </div>
  );
}

function DashboardRowItem({
  row,
  sessions,
  students,
  settings,
}: {
  row: DashboardRow;
  sessions: SessionRow[];
  students: StudentComboboxOption[];
  settings: DashboardSettings;
}) {
  const [open, setOpen] = useState(false);

  // De-emphasize $0/no-hour students (still shown per D-12) so the eye is
  // drawn to who currently owes money first.
  const isZero = row.unbilledAmountCents === 0;
  const textClass = isZero ? "text-zinc-600" : "text-zinc-900";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      {/* Row header — a <button> can't nest a <button>, so the accordion
          toggle (chevron + name) and the Generate Invoice trigger are
          siblings inside a plain wrapper div, not one full-row button
          (Surface 2 DOM restructure). Overall row stays min-h-11 tall. */}
      <div className="flex min-h-11 w-full items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={`size-4 shrink-0 text-zinc-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
          <span className={`text-base font-medium ${textClass}`}>
            {row.name}
          </span>
        </button>
        <span className="flex items-center gap-4">
          <span className={`text-sm ${textClass}`}>
            {formatDuration(row.unbilledMinutes) || "0 min"}
          </span>
          <span className={`text-base ${textClass}`}>
            {formatCents(row.unbilledAmountCents)}
          </span>
        </span>
        {/* D-08: hidden (not disabled) at $0 unbilled — a $0 row already
            reads as de-emphasized, a disabled button adds no information. */}
        {row.unbilledAmountCents !== 0 && (
          <InvoicePreviewDialog
            student={{ id: row.id, name: row.name }}
            sessions={sessions}
            settings={settings}
          />
        )}
      </div>

      {open && (
        <div className="border-t border-zinc-200 p-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No unbilled sessions for {row.name}.
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
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{formatSessionDate(session.date)}</TableCell>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Below md: stacked cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-medium text-zinc-900">
                        {formatSessionDate(session.date)}
                      </span>
                      <SessionFormDialog
                        mode="edit"
                        session={session}
                        students={students}
                        triggerLabel="Edit"
                        triggerVariant="outline"
                        triggerSize="sm"
                      />
                    </div>
                    <span className="text-base text-zinc-600">
                      {formatDuration(session.durationMinutes)} ·{" "}
                      {formatCents(session.amountCents)}
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
