import Link from "next/link";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/format";
import { formatPeriod } from "@/lib/invoice/render";
import { cn } from "@/lib/utils";

export interface InvoiceHistoryRow {
  id: number;
  studentName: string | null;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  generatedAt: Date;
}

interface InvoiceHistoryTableProps {
  rows: InvoiceHistoryRow[];
}

// Server Component (no "use client") — a flat, newest-first invoice log
// (D-14/HIST-01). Rows are non-interactive besides a per-row `Link` to the
// shared invoice view (HIST-02), so this never needs client-side state,
// unlike the accordion-based Dashboard/Sessions tables. Cloned from
// StudentTable's exact responsive table(md+)/cards(mobile) shell + empty
// state, per this plan's read_first instruction.
export function InvoiceHistoryTable({ rows }: InvoiceHistoryTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <h2 className="text-xl leading-tight font-semibold text-zinc-900">
          No invoices yet
        </h2>
        <p className="text-base text-zinc-600">
          Generate your first invoice from the Dashboard to see it here.
        </p>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
        >
          Go to Dashboard
        </Link>
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
              <TableHead>Student</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-zinc-900">
                  {row.studentName ?? "Unknown student"}
                </TableCell>
                <TableCell>
                  {formatPeriod(row.periodStart, row.periodEnd)}
                </TableCell>
                <TableCell>{formatCents(row.totalCents)}</TableCell>
                <TableCell>{format(row.generatedAt, "PPP")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/history/${row.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      View
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Below md: stacked cards (matches StudentTable/SessionTable) */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-medium text-zinc-900">
                {row.studentName ?? "Unknown student"}
              </span>
              <Link
                href={`/history/${row.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View
              </Link>
            </div>
            <span className="text-base text-zinc-600">
              {formatPeriod(row.periodStart, row.periodEnd)}
            </span>
            <span className="text-base text-zinc-600">
              {formatCents(row.totalCents)}
            </span>
            <span className="text-base text-zinc-600">
              {format(row.generatedAt, "PPP")}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
