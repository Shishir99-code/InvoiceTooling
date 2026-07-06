// Default Settings values shipped for a first-time visit to /settings —
// editable by the tutor afterward. Pure constants, no imports (mirrors
// lib/format.ts's "no React/DB import" convention for lib/invoice utilities).
export const DEFAULT_SUBJECT_TEMPLATE = "Tutoring Invoice for {student}";

export const DEFAULT_BODY_TEMPLATE = `Hi there,

Here's the invoice for {student}'s tutoring sessions ({period}):

{invoice}

You can send payment via Zelle to {zelle}. Thank you!`;

// ZOOM-02 / D-08: a fixed built-in message for the "Send Zoom link" email —
// deliberately NOT a Settings template (no merge-token engine, no {zoom}
// invoice token). Kept here alongside the other pure invoice/email string
// helpers. The link is sent as its own email, never embedded in an invoice.
export function buildZoomEmailDraft(
  studentName: string,
  zoomLink: string,
): { subject: string; body: string } {
  return {
    subject: `Zoom link for ${studentName}'s tutoring`,
    body: `Hi there,

Here's the Zoom link for ${studentName}'s tutoring sessions:

${zoomLink}

See you there!`,
  };
}
