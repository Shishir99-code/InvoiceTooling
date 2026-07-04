import { eq } from "drizzle-orm";

import { StudentFormDialog } from "@/components/student-form-dialog";
import { StudentTable } from "@/components/student-table";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";

// Protected roster landing page (D-04: a valid session lands here directly).
// Interactive add/edit modal + table built in Plan 03.
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

      <StudentTable students={rows} />
    </div>
  );
}
