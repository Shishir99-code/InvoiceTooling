import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";

// Protected roster landing page (D-04: a valid session lands here directly).
// Thin render for this plan — full interactive table + add/edit modal arrive
// in Plan 03. This proves the protected DB read renders end to end.
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
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <h2 className="text-xl leading-tight font-semibold text-zinc-900">
            No students yet
          </h2>
          <p className="text-base text-zinc-600">
            Add your first student to get started.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {rows.map((student) => (
            <li
              key={student.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-base font-medium text-zinc-900">
                {student.name}
              </span>
              <span className="text-base text-zinc-600">
                ${(student.rateCents / 100).toFixed(2)}/hr
              </span>
              <span className="text-base text-zinc-600">
                {student.parentEmail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
