// Timezone-safe calendar-date helpers shared by slot CRUD (Plan 02) and the
// auto-log cron (Plan 03). All values are "yyyy-MM-dd" strings — the
// scheduleSlots/sessions date columns use mode:"string", so we never round-trip
// through a local JS Date (Pitfall 2 — avoids midnight UTC drift).

// Phase-4 fallback when settings.timezone is null.
export const DEFAULT_TIMEZONE = "America/New_York";

// Cap eachDateInclusive so a bad range can't loop unbounded. effectiveDate
// bounds the real catch-up window, so ~10 years is far beyond any real span.
const MAX_SPAN_DAYS = 3660;

// Local calendar date in `tz` as "yyyy-MM-dd". en-CA formats as yyyy-MM-dd.
export function todayInZone(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// 0=Sun … 6=Sat. Anchor at UTC midnight so getUTCDay reflects the calendar day
// of the string itself, independent of the runtime's local zone.
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

// Every "yyyy-MM-dd" from lower to upper inclusive. Empty when lower > upper.
// Steps a UTC-anchored Date one day at a time (never local getDate()).
export function eachDateInclusive(lower: string, upper: string): string[] {
  const out: string[] = [];
  if (lower > upper) return out;

  const d = new Date(`${lower}T00:00:00Z`);
  const end = new Date(`${upper}T00:00:00Z`);
  let guard = 0;
  while (d.getTime() <= end.getTime() && guard < MAX_SPAN_DAYS) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
    guard++;
  }
  return out;
}
