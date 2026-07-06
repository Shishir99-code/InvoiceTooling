// Display helpers for weekly slots (UI-SPEC Surface 1). Pure — no React, no DB.
// Weekday indexing matches weekdayOf in lib/schedule/time.ts (0=Sun … 6=Sat).

export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Total minutes since midnight → { h12, min, meridiem } (12-hour clock).
function to12h(totalMinutes: number): { h12: number; min: number; meridiem: string } {
  const h24 = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  const meridiem = h24 < 12 ? "AM" : "PM";
  const mod = h24 % 12;
  const h12 = mod === 0 ? 12 : mod;
  return { h12, min, meridiem };
}

function durationPhrase(durationMinutes: number): string {
  const hrs = Math.floor(durationMinutes / 60);
  const min = durationMinutes % 60;
  const hrPart = hrs > 0 ? `${hrs} ${hrs === 1 ? "hr" : "hrs"}` : "";
  const minPart = min > 0 ? `${min} min` : "";
  if (hrPart && minPart) return `${hrPart} ${minPart}`;
  return hrPart || minPart || "0 min";
}

// e.g. formatSlotLabel(1, "15:30", 60) → "Mondays, 3:30–4:30 PM · 1 hr"
export function formatSlotLabel(
  weekday: number,
  startTime: string,
  durationMinutes: number,
): string {
  const dayLabel = WEEKDAY_OPTIONS[weekday]?.label ?? "";
  const dayPlural = dayLabel ? `${dayLabel}s` : "";

  const [h, m] = startTime.split(":").map((v) => Number(v));
  const startTotal = h * 60 + m;
  const endTotal = startTotal + durationMinutes;

  const start = to12h(startTotal);
  const end = to12h(endTotal);

  // Share a single AM/PM when both endpoints fall in the same meridiem.
  const range =
    start.meridiem === end.meridiem
      ? `${start.h12}:${pad2(start.min)}–${end.h12}:${pad2(end.min)} ${end.meridiem}`
      : `${start.h12}:${pad2(start.min)} ${start.meridiem}–${end.h12}:${pad2(end.min)} ${end.meridiem}`;

  return `${dayPlural}, ${range} · ${durationPhrase(durationMinutes)}`;
}
