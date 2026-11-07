CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_provider_account_unique" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "followup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"klien_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"hasil_followup_id" uuid NOT NULL,
	"deskripsi" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "followup_tanggal_lampau_check" CHECK ("followup"."tanggal" <= (now() AT TIME ZONE 'Asia/Jakarta')::date)
);
--> statement-breakpoint
CREATE TABLE "hasil_followup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "karyawan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nama" text NOT NULL,
	"level" text NOT NULL,
	"supervisor_id" uuid,
	"aktif" boolean DEFAULT true NOT NULL,
	"harus_ganti_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "karyawan_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "karyawan_level_check" CHECK ("karyawan"."level" IN ('Magang', 'Tetap')),
	CONSTRAINT "karyawan_supervisor_bukan_diri_check" CHECK ("karyawan"."supervisor_id" IS NULL OR "karyawan"."supervisor_id" <> "karyawan"."id")
);
--> statement-breakpoint
CREATE TABLE "klien" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"karyawan_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"kontak" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "koreksi_laporan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"laporan_id" uuid NOT NULL,
	"korektor_id" uuid NOT NULL,
	"alasan" text NOT NULL,
	"sebelum" jsonb NOT NULL,
	"sesudah" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "koreksi_laporan_alasan_check" CHECK (length(btrim("koreksi_laporan"."alasan")) > 0)
);
--> statement-breakpoint
CREATE TABLE "laporan_anggota" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"laporan_id" uuid NOT NULL,
	"anggota_id" uuid NOT NULL,
	"kehadiran" text,
	"keterangan_hadir" text,
	"media_online" integer,
	"media_offline" integer,
	"one_on_one" text,
	"keterangan_one_on_one" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "laporan_anggota_laporan_anggota_unique" UNIQUE("laporan_id","anggota_id"),
	CONSTRAINT "laporan_anggota_kehadiran_check" CHECK ("laporan_anggota"."kehadiran" IS NULL OR "laporan_anggota"."kehadiran" IN ('Tepat Waktu', 'Terlambat < 15 Menit', 'Terlambat > 15 Menit', 'Sakit', 'Tanpa Keterangan')),
	CONSTRAINT "laporan_anggota_one_on_one_check" CHECK ("laporan_anggota"."one_on_one" IS NULL OR "laporan_anggota"."one_on_one" IN ('Pribadi', 'Sebelum Meeting Pekanan', 'Alpa')),
	CONSTRAINT "laporan_anggota_media_online_check" CHECK ("laporan_anggota"."media_online" IS NULL OR "laporan_anggota"."media_online" >= 0),
	CONSTRAINT "laporan_anggota_media_offline_check" CHECK ("laporan_anggota"."media_offline" IS NULL OR "laporan_anggota"."media_offline" >= 0)
);
--> statement-breakpoint
CREATE TABLE "laporan_pekan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pekan_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"status" text DEFAULT 'Draf' NOT NULL,
	"submitted_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "laporan_pekan_status_check" CHECK ("laporan_pekan"."status" IN ('Draf', 'Terkirim', 'Dikoreksi'))
);
--> statement-breakpoint
CREATE TABLE "nominal_iuran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"nominal" integer NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nominal_iuran_nominal_check" CHECK ("nominal_iuran"."nominal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pekan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mulai" date NOT NULL,
	"selesai" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pekan_mulai_unique" UNIQUE("mulai"),
	CONSTRAINT "pekan_mulai_minggu_check" CHECK (extract(dow from "pekan"."mulai") = 0),
	CONSTRAINT "pekan_tujuh_hari_check" CHECK ("pekan"."selesai" = "pekan"."mulai" + 6)
);
--> statement-breakpoint
CREATE TABLE "pembayaran_iuran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"karyawan_id" uuid NOT NULL,
	"bulan" date NOT NULL,
	"nominal_iuran_id" uuid NOT NULL,
	"tanggal_bayar" date NOT NULL,
	"pencatat_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pembayaran_iuran_karyawan_bulan_unique" UNIQUE("karyawan_id","bulan"),
	CONSTRAINT "pembayaran_iuran_bulan_awal_bulan_check" CHECK ("pembayaran_iuran"."bulan" = date_trunc('month', "pembayaran_iuran"."bulan")::date),
	CONSTRAINT "pembayaran_iuran_bulan_lampau_check" CHECK ("pembayaran_iuran"."bulan" <= date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta')::date)::date),
	CONSTRAINT "pembayaran_iuran_tanggal_bayar_check" CHECK ("pembayaran_iuran"."tanggal_bayar" <= (now() AT TIME ZONE 'Asia/Jakarta')::date)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_identifier_value_unique" UNIQUE("identifier","value")
);
--> statement-breakpoint
DROP TABLE "todos" CASCADE;--> statement-breakpoint
DROP TABLE "visits" CASCADE;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup" ADD CONSTRAINT "followup_klien_id_klien_id_fk" FOREIGN KEY ("klien_id") REFERENCES "public"."klien"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup" ADD CONSTRAINT "followup_hasil_followup_id_hasil_followup_id_fk" FOREIGN KEY ("hasil_followup_id") REFERENCES "public"."hasil_followup"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup" ADD CONSTRAINT "followup_created_by_karyawan_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "klien" ADD CONSTRAINT "klien_karyawan_id_karyawan_id_fk" FOREIGN KEY ("karyawan_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "koreksi_laporan" ADD CONSTRAINT "koreksi_laporan_laporan_id_laporan_pekan_id_fk" FOREIGN KEY ("laporan_id") REFERENCES "public"."laporan_pekan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "koreksi_laporan" ADD CONSTRAINT "koreksi_laporan_korektor_id_karyawan_id_fk" FOREIGN KEY ("korektor_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laporan_anggota" ADD CONSTRAINT "laporan_anggota_laporan_id_laporan_pekan_id_fk" FOREIGN KEY ("laporan_id") REFERENCES "public"."laporan_pekan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laporan_anggota" ADD CONSTRAINT "laporan_anggota_anggota_id_karyawan_id_fk" FOREIGN KEY ("anggota_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laporan_pekan" ADD CONSTRAINT "laporan_pekan_pekan_id_pekan_id_fk" FOREIGN KEY ("pekan_id") REFERENCES "public"."pekan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laporan_pekan" ADD CONSTRAINT "laporan_pekan_supervisor_id_karyawan_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pembayaran_iuran" ADD CONSTRAINT "pembayaran_iuran_karyawan_id_karyawan_id_fk" FOREIGN KEY ("karyawan_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pembayaran_iuran" ADD CONSTRAINT "pembayaran_iuran_nominal_iuran_id_nominal_iuran_id_fk" FOREIGN KEY ("nominal_iuran_id") REFERENCES "public"."nominal_iuran"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pembayaran_iuran" ADD CONSTRAINT "pembayaran_iuran_pencatat_id_karyawan_id_fk" FOREIGN KEY ("pencatat_id") REFERENCES "public"."karyawan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "followup_klien_tanggal_idx" ON "followup" USING btree ("klien_id","tanggal");--> statement-breakpoint
CREATE INDEX "followup_created_by_tanggal_idx" ON "followup" USING btree ("created_by","tanggal");--> statement-breakpoint
CREATE INDEX "karyawan_supervisor_id_idx" ON "karyawan" USING btree ("supervisor_id");--> statement-breakpoint
CREATE INDEX "klien_karyawan_id_idx" ON "klien" USING btree ("karyawan_id");--> statement-breakpoint
CREATE INDEX "koreksi_laporan_laporan_id_idx" ON "koreksi_laporan" USING btree ("laporan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "laporan_pekan_hidup_unique" ON "laporan_pekan" USING btree ("supervisor_id","pekan_id") WHERE "laporan_pekan"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");