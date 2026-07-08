import { desc, eq } from "drizzle-orm";

import { SessionFormDialog } from "@/components/session-form-dialog";
import { SessionTable, type SessionGroup } from "@/components/session-table";
import { db } from "@/lib/db";
import { sessions, students } from "@/lib/db/schema";

// Sessions route (D-08..D-10): grouped-by-student session log with
// add/edit/delete wired to Plan 02-02's Server Actions.
export default async function SessionsPage() {
  const [activeStudents, sessionRows] = await Promise.all([
    db
      .select()
      .from(students)
      .where(eq(students.archived, false))
      .orderBy(students.name),
    db
      .select({
        session: sessions,
        studentName: students.name,
        studentArchived: students.archived,
      })
      .from(sessions)
      .leftJoin(students, eq(sessions.studentId, students.id))
      .orderBy(desc(sessions.date)),
  ]);

  // Seed a group per active student (even with zero sessions, per UI-SPEC
  // Surface 3's per-group empty state), then attach sessions — creating an
  // archived-student group on demand if a historical session references one
  // (RESEARCH.md Open Question 2: preserve history with an "Archived" badge
  // rather than hiding it).
  const groupsByStudent = new Map<number, SessionGroup>();
  for (const student of activeStudents) {
    groupsByStudent.set(student.id, {
      studentId: student.id,
      studentName: student.name,
      archived: false,
      sessions: [],
    });
  }
  for (const row of sessionRows) {
    const studentId = row.session.studentId;
    if (!groupsByStudent.has(studentId)) {
      groupsByStudent.set(studentId, {
        studentId,
        studentName: row.studentName ?? "Unknown student",
        archived: row.studentArchived ?? false,
        sessions: [],
      });
    }
    groupsByStudent.get(studentId)!.sessions.push(row.session);
  }

  // Active students first, archived after; alphabetical within each group.
  const groups = Array.from(groupsByStudent.values()).sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return a.studentName.localeCompare(b.studentName);
  });

  const hasAnySessions = sessionRows.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">
          Sessions
        </h1>
        {/* "Always visible once sessions exist" — the empty state renders
            its own centered Log Session button (mirrors D-15). */}
        {hasAnySessions && (
          <SessionFormDialog
            mode="add"
            students={activeStudents}
            triggerLabel="Log Session"
            triggerClassName="bg-primary text-primary-foreground hover:bg-primary/90"
          />
        )}
      </div>

      <SessionTable
        groups={groups}
        students={activeStudents}
        emptyStateAction={
          <SessionFormDialog
            mode="add"
            students={activeStudents}
            triggerLabel="Log Session"
            triggerClassName="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          />
        }
      />
    </div>
  );
}
