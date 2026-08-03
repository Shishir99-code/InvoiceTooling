CREATE TABLE "dismissed_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_slot_id" integer NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "makeup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dismissed_occurrences" ADD CONSTRAINT "dismissed_occurrences_schedule_slot_id_schedule_slots_id_fk" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dismissed_occurrences_slot_date_idx" ON "dismissed_occurrences" USING btree ("schedule_slot_id","date");