import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  rateCents: integer("rate_cents").notNull(), // D-07: integer cents, never float
  parentEmail: varchar("parent_email", { length: 255 }).notNull(), // D-13: required
  archived: boolean("archived").notNull().default(false), // D-10/D-11: soft delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginAttempts = pgTable("login_attempts", {
  ipAddress: varchar("ip_address", { length: 45 }).primaryKey(), // IPv6-safe length
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
});
