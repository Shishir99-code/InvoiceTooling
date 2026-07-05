import { asc, desc, eq, sql } from "drizzle-orm";

import { DashboardTable } from "@/components/dashboard-table";
import { db } from "@/lib/db";
import { sessions, students } from "@/lib/db/schema";

// DASH-01/DASH-02 aggregate: LEFT JOIN (so $0/no-session students still show
// per D-12) + GROUP BY + an aggregate FILTER (WHERE billed = false) so billed
// sessions are excluded from the sums without hiding the student row itself
// (Pitfall 4 — NOT an inner join, NOT a WHERE clause on sessions.billed).
const unbilledMinutesExpr = sql<number>`coalesce(sum(${sessions.durationMinutes}) filter (where ${sessions.billed} = false), 0)`;
const unbilledAmountExpr = sql<number>`coalesce(sum(${sessions.amountCents}) filter (where ${sessions.billed} = false), 0)`;

// Separate condition (billed must equal false) used below to fetch the
// individual unbilled session rows for each expanded-row Edit path (Task 2)
// — a plain WHERE is correct here since this query lists rows, it does not
// need to preserve $0/no-session students the way the aggregate roster query
// above does.
const isUnbilled = eq(sessions.billed, false);

export default async function DashboardPage() {
  const [dashboardRows, activeStudents, unbilledSessionRows, totalSessionCountRows] =
    await Promise.all([
      db
        .select({
          id: students.id,
          name: students.name,
          unbilledMinutes: unbilledMinutesExpr.mapWith(Number),
          unbilledAmountCents: unbilledAmountExpr.mapWith(Number),
        })
        .from(students)
        .leftJoin(sessions, eq(sessions.studentId, students.id))
        .where(eq(students.archived, false)) // D-12/D-13: archived students never appear
        .groupBy(students.id, students.name)
        .orderBy(desc(unbilledAmountExpr), asc(students.name)), // most-owed first, alpha tiebreak
      db
        .select()
        .from(students)
        .where(eq(students.archived, false))
        .orderBy(students.name),
      db.select().from(sessions).where(isUnbilled).orderBy(desc(sessions.date)),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sessions),
    ]);

  // Group the unbilled session rows by student for each expanded row's
  // session list (D-11/D-13) — a plain object, not a Map, so it serializes
  // cleanly across the Server -> Client Component boundary.
  const sessionsByStudentId: Record<number, typeof unbilledSessionRows> = {};
  for (const session of unbilledSessionRows) {
    (sessionsByStudentId[session.studentId] ??= []).push(session);
  }

  const hasAnySessions = (totalSessionCountRows[0]?.count ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">
        Dashboard
      </h1>
      {/* Glance view — no primary CTA here (D-11: "a path to edit," not add). */}
      {!hasAnySessions && (
        <p className="mt-2 text-sm text-zinc-600">
          No sessions logged yet — amounts will appear here once you log your
          first session.
        </p>
      )}

      <div className="mt-6">
        <DashboardTable
          rows={dashboardRows}
          sessionsByStudentId={sessionsByStudentId}
          students={activeStudents}
        />
      </div>
    </div>
  );
}
