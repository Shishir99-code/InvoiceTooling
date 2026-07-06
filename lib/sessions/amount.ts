// Single source of truth for the session amount formula.
// Math.round avoids float drift (19.99 * 100 === 1998.999...999998 in JS) —
// single rounding step over integer inputs (SESS-05). Reused by manual logging
// AND the auto-log cron so they stay identical at the data level.
export function computeAmountCents(
  durationMinutes: number,
  rateCents: number,
): number {
  return Math.round((durationMinutes * rateCents) / 60);
}
