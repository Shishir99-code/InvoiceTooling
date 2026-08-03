import { and, eq, gte, lte } from "drizzle-orm";
import { format } from "date-fns";

import {
  CalendarView,
  type CalendarDay,
} from "@/components/calendar-view";
import { db } from "@/lib/db";
import {
  dismissedOccurrences,
  scheduleSlots,
  sessions,
  settings,
  students,
} from "@/lib/db/schema";
import { occurrencesInRange } from "@/lib/schedule/occurrences";
import { DEFAULT_TIMEZONE, todayInZone } from "@/lib/schedule/time";

// The whole page derives from live data on every request — pending
// occurrences are computed here, never stored, so nothing async exists
// between "class happened" and "tutor confirms it".
export const dynamic = "force-dynamic";

// "YYYY-MM" strictly; anything else falls back to the current month.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;

  const [settingsRow] = await db
    .select({ timezone: settings.timezone })
    .from(settings)
    .where(eq(settings.id, 1));
  const today = todayInZone(settingsRow?.timezone ?? DEFAULT_TIMEZONE);

  const month =
    params.month && MONTH_RE.test(params.month)
      ? params.month
      : today.slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

  const [slotRows, sessionRows, dismissedRows] = await Promise.all([
    db
      .select({
        id: scheduleSlots.id,
        studentId: scheduleSlots.studentId,
        weekday: scheduleSlots.weekday,
        startTime: scheduleSlots.startTime,
        durationMinutes: scheduleSlots.durationMinutes,
        effectiveDate: scheduleSlots.effectiveDate,
        studentName: students.name,
        rateCents: students.rateCents,
      })
      .from(scheduleSlots)
      .innerJoin(students, eq(scheduleSlots.studentId, students.id)),
    db
      .select({
        id: sessions.id,
        date: sessions.date,
        durationMinutes: sessions.durationMinutes,
        scheduleSlotId: sessions.scheduleSlotId,
        studentName: students.name,
      })
      .from(sessions)
      .leftJoin(students, eq(sessions.studentId, students.id))
      .where(and(gte(sessions.date, monthStart), lte(sessions.date, monthEnd))),
    db
      .select({
        scheduleSlotId: dismissedOccurrences.scheduleSlotId,
        date: dismissedOccurrences.date,
      })
      .from(dismissedOccurrences)
      .where(
        and(
          gte(dismissedOccurrences.date, monthStart),
          lte(dismissedOccurrences.date, monthEnd),
        ),
      ),
  ]);

  const slotsById = new Map(slotRows.map((s) => [s.id, s]));

  // A logged session "claims" its slot occurrence for that date, hiding the
  // pending chip. Manual sessions (null scheduleSlotId) display independently.
  const loggedOccurrences = new Set(
    sessionRows
      .filter((s) => s.scheduleSlotId !== null)
      .map((s) => `${s.scheduleSlotId}:${s.date}`),
  );

  // DISM-01: occurrences the tutor explicitly discarded. Same (slot, date) key
  // shape as loggedOccurrences so both filters read alike below.
  const dismissedKeys = new Set(
    dismissedRows.map((d) => `${d.scheduleSlotId}:${d.date}`),
  );

  const days = new Map<string, CalendarDay>();
  for (let i = 1; i <= daysInMonth(month); i++) {
    const date = `${month}-${String(i).padStart(2, "0")}`;
    days.set(date, { date, logged: [], pending: [], upcoming: [], dismissed: [] });
  }

  for (const session of sessionRows) {
    days.get(session.date)?.logged.push({
      id: session.id,
      studentName: session.studentName ?? "Unknown student",
      durationMinutes: session.durationMinutes,
    });
  }

  for (const occ of occurrencesInRange(slotRows, monthStart, monthEnd)) {
    if (loggedOccurrences.has(`${occ.slotId}:${occ.date}`)) continue;
    const slot = slotsById.get(occ.slotId);
    const day = days.get(occ.date);
    if (!slot || !day) continue;

    const chip = {
      slotId: slot.id,
      date: occ.date,
      studentName: slot.studentName,
      startTime: slot.startTime,
      durationMinutes: slot.durationMinutes,
      rateCents: slot.rateCents,
    };
    // Dismissed wins over pending/upcoming: the tutor said this class did not
    // happen, so it must never sit in the "needs logging" pile or be swept up
    // by "Log all pending".
    if (dismissedKeys.has(`${occ.slotId}:${occ.date}`)) {
      day.dismissed.push(chip);
    } else if (occ.date <= today) {
      day.pending.push(chip);
    } else {
      day.upcoming.push(chip);
    }
  }

  for (const day of days.values()) {
    day.pending.sort((a, b) => a.startTime.localeCompare(b.startTime));
    day.upcoming.sort((a, b) => a.startTime.localeCompare(b.startTime));
    day.dismissed.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <CalendarView
        monthLabel={format(new Date(`${monthStart}T00:00:00`), "MMMM yyyy")}
        prevMonth={shiftMonth(month, -1)}
        nextMonth={shiftMonth(month, 1)}
        today={today}
        days={Array.from(days.values())}
        hasSlots={slotRows.length > 0}
      />
    </div>
  );
}
