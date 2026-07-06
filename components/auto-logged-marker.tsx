import { Repeat } from "lucide-react";

import { cn } from "@/lib/utils";

// SCHED-04 / D-03: the whole distinction between an auto-logged and a manual
// session is the presence of this muted glyph — no text badge, no placeholder
// for manual rows. Meaningful icon (aria-label + title), never aria-hidden,
// and muted (text-zinc-400) rather than an accent color (UI-SPEC Surface 3).
// Presentational — safe as a server component (no client hooks).
export function AutoLoggedMarker({ className }: { className?: string }) {
  return (
    <Repeat
      aria-label="Auto-logged from weekly schedule"
      role="img"
      className={cn("size-3.5 shrink-0 text-zinc-400 md:size-4", className)}
    >
      <title>Auto-logged from weekly schedule</title>
    </Repeat>
  );
}
