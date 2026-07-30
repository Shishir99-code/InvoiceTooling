import { eachDateInclusive, weekdayOf } from "@/lib/schedule/time";

// A single derived class occurrence: slot X falls on calendar date Y. Purely
// computed — occurrences are never stored. The Calendar tab derives them at
// render time from schedule_slots, and a session row only comes into
// existence when the tutor confirms one.
export interface SlotOccurrence {
  slotId: number;
  date: string; // "yyyy-MM-dd"
}

export interface OccurrenceSlot {
  id: number;
  weekday: number; // 0=Sun … 6=Sat
  effectiveDate: string; // "yyyy-MM-dd" floor — no occurrences before the slot existed
}

// All occurrences of `slots` between lower and upper inclusive. effectiveDate
// is the per-slot floor (D-08: no retroactive backfill before slot creation).
// String comparison is valid for "yyyy-MM-dd".
export function occurrencesInRange(
  slots: OccurrenceSlot[],
  lower: string,
  upper: string,
): SlotOccurrence[] {
  const out: SlotOccurrence[] = [];
  for (const date of eachDateInclusive(lower, upper)) {
    const weekday = weekdayOf(date);
    for (const slot of slots) {
      if (slot.weekday === weekday && date >= slot.effectiveDate) {
        out.push({ slotId: slot.id, date });
      }
    }
  }
  return out;
}
