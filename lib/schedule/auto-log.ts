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
      console.log(`[runAutoLog] Processing slot ${slot.id}:`, {
        weekday: slot.weekday,
        effectiveDate: slot.effectiveDate,
        lastLoggedDate: slot.lastLoggedDate,
      });

      // Window: from the day AFTER the HWM (or effectiveDate if never processed)
      // up to today. String compare is valid for yyyy-MM-dd.
      const lower = slot.lastLoggedDate
        ? nextDay(slot.lastLoggedDate)
        : slot.effectiveDate;
      const upper = today;

      console.log(`[runAutoLog] Date window for slot ${slot.id}:`, { lower, upper, today });

      if (lower > upper) {
        // Nothing new for this slot — leave the HWM untouched.
        console.log(`[runAutoLog] Slot ${slot.id}: lower > upper, skipping`);
        continue;
      }

      // Build ALL insert rows in JS BEFORE opening the transaction. The
      // neon-http driver batches a fixed set of writes with no intermediate
      // reads, so we must not query/branch inside the transaction callback.
      const allDates = eachDateInclusive(lower, upper);
      console.log(`[runAutoLog] Slot ${slot.id}: Generated ${allDates.length} dates between ${lower} and ${upper}`);

      const insertRows = allDates
        .filter((d) => {
          const slotWeekday = weekdayOf(d);
          const matches = slotWeekday === slot.weekday;
          console.log(`[runAutoLog] Slot ${slot.id}: Checking ${d}: weekday=${slotWeekday}, expected=${slot.weekday}, matches=${matches}`);
          return matches;
        })
        .map((d) => ({
          studentId: slot.studentId,
          date: d,
          durationMinutes: slot.durationMinutes,
          amountCents: computeAmountCents(slot.durationMinutes, slot.rateCents),
          notes: null, // D-04: auto-logged sessions carry no notes
          billed: false,
          scheduleSlotId: slot.id, // D-04: marks this session as auto-logged
        }));

      console.log(`[runAutoLog] Slot ${slot.id}: Creating ${insertRows.length} sessions`);

      // Neon HTTP driver doesn't support transactions, so we do insert then update
      // sequentially. If a crash happens between them, the next run will re-insert
      // (idempotent via duplicate detection below).
      try {
        if (insertRows.length) {
          console.log(`[runAutoLog] Slot ${slot.id}: Inserting ${insertRows.length} rows...`);
          await db.insert(sessions).values(insertRows);
          console.log(`[runAutoLog] Slot ${slot.id}: Insert complete`);
        }

        // Advance the HWM for this slot
        await db
          .update(scheduleSlots)
          .set({ lastLoggedDate: upper })
          .where(eq(scheduleSlots.id, slot.id));
        console.log(`[runAutoLog] Slot ${slot.id}: Updated HWM to ${upper}`);

        processedSlots++;
        sessionsCreated += insertRows.length;
        console.log(`[runAutoLog] Slot ${slot.id}: Complete, sessionsCreated = ${sessionsCreated}`);
      } catch (error) {
        console.error(`[runAutoLog] Slot ${slot.id}: Failed:`, error);
        throw error;
      }
    } catch {
      // Never let one bad slot block the rest — skip and continue.
      continue;
    }
  }

  return { processedSlots, sessionsCreated };
}
