import { pgTable, serial, varchar, integer, boolean, timestamp, date, text } from "drizzle-orm/pg-core";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  rateCents: integer("rate_cents").notNull(), // D-07: integer cents, never float
  parentEmail: varchar("parent_email", { length: 255 }).notNull(), // D-13: required
  archived: boolean("archived").notNull().default(false), // D-10/D-11: soft delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }), // never cascade — archived students keep history
  date: date("date", { mode: "string" }).notNull(), // mode "string": avoids TZ-shift
  durationMinutes: integer("duration_minutes").notNull(), // hours+minutes combine into this
  amountCents: integer("amount_cents").notNull(), // D-14: frozen snapshot, computed server-side once at write time
  notes: text("notes"), // SESS-02: optional
  billed: boolean("billed").notNull().default(false), // Phase 3 sets true; Phase 2 only reads for DASH-02
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginAttempts = pgTable("login_attempts", {
  ipAddress: varchar("ip_address", { length: 45 }).primaryKey(), // IPv6-safe length
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
});
