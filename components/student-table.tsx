import { StudentFormDialog } from "@/components/student-form-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { students } from "@/lib/db/schema";

type Student = typeof students.$inferSelect;

function formatRate(rateCents: number) {
  return `$${(rateCents / 100).toFixed(2)}`;
}

// Server Component: renders the roster rows/cards passed in from the page,
// or the D-15 empty state when there are none yet.
export function StudentTable({ students }: { students: Student[] }) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <h2 className="text-xl leading-tight font-semibold text-zinc-900">
          No students yet
        </h2>
        <p className="text-base text-zinc-600">
          Add your first student to get started.
        </p>
        <StudentFormDialog
          mode="add"
          triggerLabel="Add Student"
          triggerClassName="mt-4 bg-blue-600 text-white hover:bg-blue-700"
        />
      </div>
    );
  }

  return (
    <>
      {/* md+ breakpoint: table */}
      <div className="hidden rounded-lg border border-zinc-200 bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium text-zinc-900">
                  {student.name}
                </TableCell>
                <TableCell>{formatRate(student.rateCents)}</TableCell>
                <TableCell>{student.parentEmail}</TableCell>
                <TableCell className="text-right">
                  <StudentFormDialog
                    mode="edit"
                    student={student}
                    triggerLabel="Edit"
                    triggerVariant="outline"
                    triggerSize="sm"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Below md: stacked cards (D-14 mobile-friendly, avoids a
          horizontally-scrolling 4-column table on phones) */}
      <div className="flex flex-col gap-3 md:hidden">
        {students.map((student) => (
          <div
            key={student.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-medium text-zinc-900">
                {student.name}
              </span>
              <StudentFormDialog
                mode="edit"
                student={student}
                triggerLabel="Edit"
                triggerVariant="outline"
                triggerSize="sm"
              />
            </div>
            <span className="text-base text-zinc-600">
              {formatRate(student.rateCents)}/hr
            </span>
            <span className="text-base text-zinc-600">
              {student.parentEmail}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
