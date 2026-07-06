"use client";

import { buttonVariants } from "@/components/ui/button";
import { buildZoomEmailDraft } from "@/lib/invoice/defaults";
import { buildGmailComposeUrl } from "@/lib/invoice/mailto";
import { cn } from "@/lib/utils";

// ZOOM-02: roster-only "Send Zoom link" action. Opens a NEW-tab Gmail compose
// draft addressed to the parent, pre-filled with the fixed built-in Zoom
// message (D-08) — a SEPARATE email, never baked into an invoice (D-07/D-10).
// A direct anchor inside the click needs no window-handle dance (unlike the
// post-Server-Action MAIL-05 flow); the message is tiny so there is no
// over-length/copy fallback here.
export function SendZoomLinkButton({
  studentName,
  parentEmail,
  zoomLink,
}: {
  studentName: string;
  parentEmail: string;
  zoomLink: string | null;
}) {
  // D-09: hidden entirely when there is nothing to send.
  if (!zoomLink) {
    return null;
  }

  const { subject, body } = buildZoomEmailDraft(studentName, zoomLink);
  const gmailUrl = buildGmailComposeUrl({ to: parentEmail, subject, body });

  return (
    <a
      href={gmailUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      Send Zoom link
    </a>
  );
}
