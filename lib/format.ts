// Shared money/duration display helpers (extracted from
// components/student-table.tsx's inline `formatRate` per Phase 2 CONTEXT.md
// Claude's Discretion) — single source of truth for all money/duration
// formatting: session row amounts, dashboard totals, future Phase 3 invoices.

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// UI-SPEC Data Formatting Conventions: "{h} hr(s) {m} min", omitting the zero
// part — mirrors the tutor's own mental model ("an hour and a half"), not a
// decimal-hours display.
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const hourPart = hours > 0 ? `${hours} ${hours === 1 ? "hr" : "hrs"}` : "";
  const minPart = mins > 0 ? `${mins} min` : "";

  return [hourPart, minPart].filter(Boolean).join(" ");
}
