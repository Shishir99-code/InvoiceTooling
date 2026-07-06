// SET-03 (RESEARCH §3): a US-timezone shortlist for the Settings picker plus a
// runtime IANA validator. Pure module — no React/DB import (mirrors
// lib/invoice/defaults.ts). The stored value is an IANA string; Phase 5/6
// consume it for class-day resolution and invoice cadence — Phase 4 only
// captures it.

export const US_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (America/New_York)" },
  { value: "America/Chicago", label: "Central (America/Chicago)" },
  { value: "America/Denver", label: "Mountain (America/Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
  { value: "America/Phoenix", label: "Arizona (America/Phoenix)" },
  { value: "America/Anchorage", label: "Alaska (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Pacific/Honolulu)" },
];

// Node 20 / modern browsers throw a RangeError from Intl.DateTimeFormat for an
// unrecognized IANA zone — so a successful construction is our validity check.
export function isValidIanaTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
