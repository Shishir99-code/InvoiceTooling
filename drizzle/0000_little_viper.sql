CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_cents" integer NOT NULL,
	"line_items" jsonb NOT NULL,
	"rendered_body" text NOT NULL,
	"rendered_subject" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"sent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"ip_address" varchar(45) PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "schedule_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"effective_date" date NOT NULL,
	"last_logged_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"date" date NOT NULL,
	"duration_minutes" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"notes" text,
	"billed" boolean DEFAULT false NOT NULL,
	"invoice_id" integer,
	"schedule_slot_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"zelle_handle" varchar(255) DEFAULT '' NOT NULL,
	"subject_template" varchar(500) NOT NULL,
	"body_template" text NOT NULL,
	"timezone" varchar(64),
	"invoice_cadence_enabled" boolean DEFAULT false NOT NULL,
	"invoice_cadence_day" integer,
	"invoice_cadence_last_day" boolean DEFAULT false NOT NULL,
	"last_invoiced_month" varchar(7),
	"gmail_user_email" varchar(255),
	"gmail_app_password" text,
	"gmail_verified" boolean DEFAULT false NOT NULL,
	"gmail_last_error" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"rate_cents" integer NOT NULL,
	"parent_email" varchar(255) NOT NULL,
	"zoom_link" varchar(512),
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_schedule_slot_id_schedule_slots_id_fk" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slots"("id") ON DELETE set null ON UPDATE no action;