import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { scheduleSlots, sessions, settings, students } from "@/lib/db/schema";
import {
  DEFAULT_TIMEZONE,
  eachDateInclusive,
  todayInZone,
  weekdayOf,
} from "@/lib/schedule/time";
import { computeAmountCents } from "@/lib/sessions/amount";

// The next calendar day after a "yyyy-MM-dd" string, UTC-anchored so it never
// drifts across the runtime's local midnight.
function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Idempotent catch-up engine (SCHED-03). On each run it logs one session for
// every un-processed past class day (up to today in the tutor's timezone) for
// every slot, then advances that slot's lastLoggedDate high-water-mark (D-05).
// Idempotency comes from the per-slot HWM, NOT the existence of a session row —
// so a deleted auto-session is never re-created, and a skipped/late Hobby-plan
// run self-heals by catching up the whole gap.
export async function runAutoLog(): Promise<{
  processedSlots: number;
  sessionsCreated: number;
}> {
  const [settingsRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, 1));
  const tz = settingsRow?.timezone ?? DEFAULT_TIMEZONE;
  const today = todayInZone(tz);

  // Load every slot with its student's CURRENT rate. innerJoin skips slots whose
  // student row is missing (defensive). Archived students still log — billing
  // decisions are downstream; history is preserved.
  const rows = await db
    .select({
      id: scheduleSlots.id,
      studentId: scheduleSlots.studentId,
      weekday: scheduleSlots.weekday,
      durationMinutes: scheduleSlots.durationMinutes,
      effectiveDate: scheduleSlots.effectiveDate,
      lastLoggedDate: scheduleSlots.lastLoggedDate,
      rateCents: students.rateCents,
    })
    .from(scheduleSlots)
    .innerJoin(students, eq(scheduleSlots.studentId, students.id));

  let processedSlots = 0;
  let sessionsCreated = 0;

  for (const slot of rows) {
    try {
      // Window: from the day AFTER the HWM (or effectiveDate if never processed)
      // up to today. String compare is valid for yyyy-MM-dd.
      const lower = slot.lastLoggedDate
        ? nextDay(slot.lastLoggedDate)
        : slot.effectiveDate;
      const upper = today;

      if (lower > upper) {
        // Nothing new for this slot — leave the HWM untouched.
        continue;
      }

      // Build ALL insert rows in JS BEFORE opening the transaction. The
      // neon-http driver batches a fixed set of writes with no intermediate
      // reads, so we must not query/branch inside the transaction callback.
      const insertRows = eachDateInclusive(lower, upper)
        .filter((d) => weekdayOf(d) === slot.weekday)
        .map((d) => ({
          studentId: slot.studentId,
          date: d,
          durationMinutes: slot.durationMinutes,
          amountCents: computeAmountCents(slot.durationMinutes, slot.rateCents),
          notes: null, // D-04: auto-logged sessions carry no notes
          billed: false,
          scheduleSlotId: slot.id, // D-04: marks this session as auto-logged
        }));

      // Fixed two-statement batch: bulk insert (if any) + advance the HWM to
      // `upper`. The HWM advances even when no weekday matched, so future runs
      // don't re-scan old dates. Because the update only commits if the inserts
      // also commit, a crash mid-slot re-runs cleanly with no duplicates.
      await db.transaction(async (tx) => {
        if (insertRows.length) {
          await tx.insert(sessions).values(insertRows);
        }
        await tx
          .update(scheduleSlots)
          .set({ lastLoggedDate: upper })
          .where(eq(scheduleSlots.id, slot.id));
      });

      processedSlots++;
      sessionsCreated += insertRows.length;
    } catch {
      // Never let one bad slot block the rest — skip and continue.
      continue;
    }
  }

  return { processedSlots, sessionsCreated };
}
