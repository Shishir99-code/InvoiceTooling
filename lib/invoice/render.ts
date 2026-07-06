// Invoice-text rendering — the single source of truth for how a frozen
// invoice's itemized text and merge-field template are produced (mirrors
// lib/format.ts's "single source of truth" convention). Pure functions only,
// NO React/DB import — reused by generateInvoiceAction (freeze time) and, in
// a later plan, by any re-send/re-copy flow, so it must stay side-effect-free
// and importable from both server and client code.

import { format } from "date-fns";

import { formatCents, formatDuration } from "@/lib/format";

export interface InvoiceLineItem {
  date: string;
  durationMinutes: number;
  amountCents: number;
  notes: string | null;
}

interface SessionLike {
  date: string;
  durationMinutes: number;
  amountCents: number;
  notes: string | null;
}

// Maps raw session rows -> the frozen InvoiceLineItem shape. Pure pass-
// through (no derived fields) — kept as its own function so callers never
// hand-assemble the frozen jsonb shape inline.
export function buildLineItems(sessions: SessionLike[]): InvoiceLineItem[] {
  return sessions.map((session) => ({
    date: session.date,
    durationMinutes: session.durationMinutes,
    amountCents: session.amountCents,
    notes: session.notes,
  }));
}

// D-03 / UI-SPEC period label: both dates are "yyyy-MM-dd" strings. A single
// session collapses to one date; otherwise an en-dash range with spaces both
// sides. Pitfall 2 precedent: only convert to a JS Date transiently for
// display, never round-trip storage through it.
export function formatPeriod(startDate: string, endDate: string): string {
  const start = format(new Date(`${startDate}T00:00:00`), "PPP");
  if (startDate === endDate) {
    return start;
  }
  const end = format(new Date(`${endDate}T00:00:00`), "PPP");
  return `${start} – ${end}`;
}

// D-01/D-04/D-05, UI-SPEC Data Formatting Conventions: the `{invoice}` merge
// block — header line (no branding, no invoice number), period label, blank
// line, one line per session (`date · duration · amount`, plus an indented
// note line ONLY when the session has a non-empty note), blank line, Total.
export function renderInvoiceText(
  studentName: string,
  period: string,
  items: InvoiceLineItem[],
): string {
  const lines: string[] = [];

  lines.push(`Tutoring Invoice — ${studentName}`);
  lines.push(period);
  lines.push("");

  for (const item of items) {
    const dateLabel = format(new Date(`${item.date}T00:00:00`), "PPP");
    const durationLabel = formatDuration(item.durationMinutes);
    const amountLabel = formatCents(item.amountCents);
    lines.push(`${dateLabel} · ${durationLabel} · ${amountLabel}`);
    if (item.notes) {
      lines.push(`  ${item.notes}`);
    }
  }

  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  lines.push("");
  lines.push(`Total: ${formatCents(totalCents)}`);

  return lines.join("\n");
}

// D-12/D-13: the five merge fields supported in the Settings subject/body
// templates. Sequential replaceAll, unknown/typo'd tokens left verbatim — no
// throw, no silent strip (gives the tutor an obvious visual cue, e.g. a
// literal "{stuent}", rather than disappearing text).
export const MERGE_FIELDS = [
  "invoice",
  "student",
  "total",
  "zelle",
  "period",
] as const;

export function renderTemplate(
  template: string,
  values: Record<(typeof MERGE_FIELDS)[number], string>,
): string {
  return MERGE_FIELDS.reduce(
    (text, field) => text.replaceAll(`{${field}}`, values[field]),
    template,
  );
}
