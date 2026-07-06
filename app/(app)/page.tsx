import Link from "next/link";
import { eq } from "drizzle-orm";

import { ArchiveConfirmDialog } from "@/components/archive-confirm-dialog";
import { SendZoomLinkButton } from "@/components/send-zoom-link-button";
import { StudentFormDialog } from "@/components/student-form-dialog";
import { StudentTable } from "@/components/student-table";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";

// Protected roster landing page (D-04: a valid session lands here directly).
// Interactive add/edit modal + table built in Plan 03; archive action +
// Students/Archived tabs added in Plan 04.
export default async function StudentsPage() {
  const rows = await db.select()
    .from(students)
    .where(eq(students.archived, false))
    .orderBy(students.name); // D-08: alphabetical

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
            triggerClassName="bg-blue-600 text-white hover:bg-blue-700"
          />
        )}
      </div>

      {/* Students / Archived tab pair (D-11, UI-SPEC Surface Note #6) —
          inlined per page rather than a shared component so each page's
          active tab is unambiguous at a glance. */}
      <div className="mb-6 flex gap-6 border-b border-zinc-200">
        <Link
          href="/"
          className="-mb-px border-b-2 border-blue-600 pb-2 text-base font-medium text-blue-600"
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
              triggerClassName="mt-4 bg-blue-600 text-white hover:bg-blue-700"
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
          </>
        )}
      />
    </div>
  );
}
