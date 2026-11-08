CREATE TABLE "followup_edit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"followup_id" uuid NOT NULL,
	"editor_id" uuid NOT NULL,
	"alasan" text NOT NULL,
	"sebelum" jsonb NOT NULL,
	"sesudah" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followup" ADD COLUMN "pencatat_supervisor_id" uuid;--> statement-breakpoint
ALTER TABLE "followup_edit" ADD CONSTRAINT "followup_edit_followup_id_followup_id_fk" FOREIGN KEY ("followup_id") REFERENCES "public"."followup"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_edit" ADD CONSTRAINT "followup_edit_editor_id_karyawan_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "followup_edit_followup_id_idx" ON "followup_edit" USING btree ("followup_id");--> statement-breakpoint
ALTER TABLE "followup" ADD CONSTRAINT "followup_pencatat_supervisor_id_karyawan_id_fk" FOREIGN KEY ("pencatat_supervisor_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;