// Default Settings values shipped for a first-time visit to /settings —
// editable by the tutor afterward. Pure constants, no imports (mirrors
// lib/format.ts's "no React/DB import" convention for lib/invoice utilities).
export const DEFAULT_SUBJECT_TEMPLATE = "Tutoring Invoice for {student}";

export const DEFAULT_BODY_TEMPLATE = `Hi there,

Here's the invoice for {student}'s tutoring sessions ({period}):

{invoice}

You can send payment via Zelle to {zelle}. Thank you!`;
