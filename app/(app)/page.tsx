import Link from "next/link";
import { eq } from "drizzle-orm";

import { ArchiveConfirmDialog } from "@/components/archive-confirm-dialog";
import { SendZoomLinkButton } from "@/components/send-zoom-link-button";
import { StudentFormDialog } from "@/components/student-form-dialog";
import { StudentTable } from "@/components/student-table";
import { WeeklyScheduleDialog } from "@/components/weekly-schedule-dialog";
import { db } from "@/lib/db";
import { scheduleSlots, students } from "@/lib/db/schema";

// Protected roster landing page (D-04: a valid session lands here directly).
// Interactive add/edit modal + table built in Plan 03; archive action +
// Students/Archived tabs added in Plan 04.
// Render from the live DB on every request — never serve a build-time
// prerendered snapshot (sessions written outside a Server Action were
// invisible on Vercel until the next deploy).
export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const rows = await db.select()
    .from(students)
    .where(eq(students.archived, false))
    .orderBy(students.name); // D-08: alphabetical

  // Each student's weekly slots, grouped by studentId for the Schedule dialog.
  const slots = await db.select().from(scheduleSlots);
  const slotsByStudent = new Map<number, typeof slots>();
  for (const slot of slots) {
    const list = slotsByStudent.get(slot.studentId) ?? [];
    list.push(slot);
    slotsByStudent.set(slot.studentId, list);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">
          Students
        </h1>
        {/* "Always visible once students exist" — the empty state renders
            its own centered Add Student button (D-15) instead. */}
        {rows.length > 0 && (
          <StudentFormDialog
            mode="add"
            triggerLabel="Add Student"
            triggerClassName="bg-primary text-primary-foreground hover:bg-primary/90"
          />
        )}
      </div>

      {/* Students / Archived tab pair (D-11, UI-SPEC Surface Note #6) —
          inlined per page rather than a shared component so each page's
          active tab is unambiguous at a glance. */}
      <div className="mb-6 flex gap-6 border-b border-zinc-200">
        <Link
          href="/"
          className="-mb-px border-b-2 border-primary pb-2 text-base font-medium text-primary"
        >
          Students
        </Link>
        <Link
          href="/archived"
          className="-mb-px border-b-2 border-transparent pb-2 text-base font-medium text-zinc-600 hover:text-zinc-900"
        >
          Archived
        </Link>
      </div>

      <StudentTable
        students={rows}
        emptyState={{
          heading: "No students yet",
          body: "Add your first student to get started.",
          action: (
            <StudentFormDialog
              mode="add"
              triggerLabel="Add Student"
              triggerClassName="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
            />
          ),
        }}
        renderActions={(student) => (
          <>
            <StudentFormDialog
              mode="edit"
              student={student}
              triggerLabel="Edit"
              triggerVariant="outline"
              triggerSize="sm"
            />
            <SendZoomLinkButton
              studentName={student.name}
              parentEmail={student.parentEmail}
              zoomLink={student.zoomLink}
            />
            <ArchiveConfirmDialog
              studentId={student.id}
              studentName={student.name}
              triggerVariant="outline"
              triggerSize="sm"
            />
            <WeeklyScheduleDialog
              studentId={student.id}
              studentName={student.name}
              slots={slotsByStudent.get(student.id) ?? []}
              triggerLabel="Schedule"
              triggerVariant="outline"
              triggerSize="sm"
            />
          </>
        )}
      />
    </div>
  );
}
