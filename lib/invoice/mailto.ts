// Pure, no React/DB import — mirrors lib/format.ts's shape (Task 1 read_first).
// Gmail compose deep link builder (D-10) + over-length guard (Pitfall 5).

// Conservative safety margin below the ~2,000-char practical ceiling
// community write-ups converge on for this unofficial URL scheme
// (03-RESEARCH.md Pitfall 5 / Assumption A1).
export const GMAIL_URL_MAX_LEN = 1800;

// D-10-locked param set: view=cm&fs=1 opens a Gmail compose window addressed
// to `to` with subject `su` and body `body`. Built via URLSearchParams —
// NEVER manual string concatenation — so a stray `&`/`#`/newline in a note
// or template cannot inject extra query params or truncate the URL
// (Pitfall 6). If manual testing ever shows view=cm&fs=1 stops opening a
// compose window, the documented fallback to try is `tf=cm` (RESEARCH State
// of the Art / A3) — not implemented here.
export function buildGmailComposeUrl({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): string {
  const query = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${query.toString()}`;
}

export function isGmailUrlTooLong(url: string): boolean {
  return url.length > GMAIL_URL_MAX_LEN;
}
