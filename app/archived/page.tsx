import Link from "next/link";
import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { StudentTable } from "@/components/student-table";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { restoreStudentAction } from "@/lib/actions/students";

// Protected by the same middleware.ts choke point as "/" (deny-by-default
// matcher covers every route except /login). D-11: view archived students
// and restore them; D-10: the row is preserved, restore just flips the flag.
export default async function ArchivedStudentsPage() {
  const rows = await db.select()
    .from(students)
    .where(eq(students.archived, true))
    .orderBy(students.name);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">
          Archived Students
        </h1>
      </div>

      {/* Students / Archived tab pair, mirrored from app/page.tsx with the
          active/inactive styling swapped. */}
      <div className="mb-6 flex gap-6 border-b border-zinc-200">
        <Link
          href="/"
          className="-mb-px border-b-2 border-transparent pb-2 text-base font-medium text-zinc-600 hover:text-zinc-900"
        >
          Students
        </Link>
        <Link
          href="/archived"
          className="-mb-px border-b-2 border-blue-600 pb-2 text-base font-medium text-blue-600"
        >
          Archived
        </Link>
      </div>

      <StudentTable
        students={rows}
        emptyState={{
          heading: "No archived students",
          body: "Students you archive will show up here.",
        }}
        renderActions={(student) => (
          // Single-click restore — no confirm dialog (D-11): restoring is
          // non-destructive, unlike archiving. Arg-bound Server Action form,
          // no client component needed.
          <form action={restoreStudentAction.bind(null, student.id)}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              Restore
            </Button>
          </form>
        )}
      />
    </div>
  );
}
