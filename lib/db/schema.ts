import { pgTable, serial, varchar, integer, boolean, timestamp, date, text, jsonb } from "drizzle-orm/pg-core";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  rateCents: integer("rate_cents").notNull(), // D-07: integer cents, never float
  parentEmail: varchar("parent_email", { length: 255 }).notNull(), // D-13: required
  archived: boolean("archived").notNull().default(false), // D-10/D-11: soft delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// invoices must be declared above sessions since sessions.invoiceId
// references it — the `() => invoices.id` thunk would also handle a forward
// reference, but declaring it here keeps the file read top-to-bottom.
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }), // Pitfall 3: mirrors sessions FK, protects history; D-04: no invoice number column
  periodStart: date("period_start", { mode: "string" }).notNull(), // D-03: frozen min session date
  periodEnd: date("period_end", { mode: "string" }).notNull(), // D-03: frozen max session date
  totalCents: integer("total_cents").notNull(), // frozen sum at generation, integer cents per P2 D-14
  // frozen line items: {date,durationMinutes,amountCents,notes}[] — see lib/invoice/render.ts
  lineItems: jsonb("line_items").notNull(),
  renderedBody: text("rendered_body").notNull(), // Pitfall 4: frozen full body, never re-rendered from live Settings
  renderedSubject: text("rendered_subject").notNull(), // WR-03: text (not varchar 500) — a {student} merge can push a near-500 subject past the old bound and crash the atomic INSERT
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1), // single-row config, always id=1
  zelleHandle: varchar("zelle_handle", { length: 255 }).notNull().default(""), // SET-01
  subjectTemplate: varchar("subject_template", { length: 500 }).notNull(), // SET-02/D-13
  bodyTemplate: text("body_template").notNull(), // SET-02/D-12
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
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }), // null = unbilled; set at generation, un-links on invoice delete (D-16)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginAttempts = pgTable("login_attempts", {
  ipAddress: varchar("ip_address", { length: 45 }).primaryKey(), // IPv6-safe length
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
});
