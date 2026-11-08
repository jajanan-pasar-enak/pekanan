import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const sekarang = { withTimezone: true, mode: "date" } as const;
const hariIniWIB = sql`(now() AT TIME ZONE 'Asia/Jakarta')::date`;

// ---------------------------------------------------------------------------
// Auth lokal (Better Auth). Kolom harus persis sesuai yang diminta adapter.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", sekarang),
  createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", sekarang)
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", sekarang).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", sekarang)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", sekarang),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", sekarang),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", sekarang)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    unique("account_provider_account_unique").on(t.providerId, t.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", sekarang).notNull(),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", sekarang)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("verification_identifier_idx").on(t.identifier),
    unique("verification_identifier_value_unique").on(t.identifier, t.value),
  ],
);

// ---------------------------------------------------------------------------
// Organisasi
// ---------------------------------------------------------------------------

export const karyawan = pgTable(
  "karyawan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    nama: text("nama").notNull(),
    level: text("level").notNull(),
    supervisorId: uuid("supervisor_id"),
    aktif: boolean("aktif").notNull().default(true),
    harusGantiPassword: boolean("harus_ganti_password").notNull().default(true),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", sekarang)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: "karyawan_supervisor_id_fkey",
      columns: [t.supervisorId],
      foreignColumns: [t.id],
    }).onDelete("restrict"),
    index("karyawan_supervisor_id_idx").on(t.supervisorId),
    check("karyawan_level_check", sql`${t.level} IN ('Magang', 'Tetap')`),
    check(
      "karyawan_supervisor_bukan_diri_check",
      sql`${t.supervisorId} IS NULL OR ${t.supervisorId} <> ${t.id}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Laporan Pekan
// ---------------------------------------------------------------------------

export const pekan = pgTable(
  "pekan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mulai: date("mulai").notNull().unique(),
    selesai: date("selesai").notNull(),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
  },
  (t) => [
    check("pekan_mulai_minggu_check", sql`extract(dow from ${t.mulai}) = 0`),
    check("pekan_tujuh_hari_check", sql`${t.selesai} = ${t.mulai} + 6`),
  ],
);

export const laporanPekan = pgTable(
  "laporan_pekan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pekanId: uuid("pekan_id")
      .notNull()
      .references(() => pekan.id, { onDelete: "restrict" }),
    supervisorId: uuid("supervisor_id")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("Draf"),
    submittedAt: timestamp("submitted_at", sekarang),
    deletedAt: timestamp("deleted_at", sekarang),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", sekarang)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("laporan_pekan_hidup_unique")
      .on(t.supervisorId, t.pekanId)
      .where(sql`${t.deletedAt} IS NULL`),
    check("laporan_pekan_status_check", sql`${t.status} IN ('Draf', 'Terkirim', 'Dikoreksi')`),
  ],
);

export const laporanAnggota = pgTable(
  "laporan_anggota",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    laporanId: uuid("laporan_id")
      .notNull()
      .references(() => laporanPekan.id, { onDelete: "cascade" }),
    anggotaId: uuid("anggota_id")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    kehadiran: text("kehadiran"),
    keteranganHadir: text("keterangan_hadir"),
    mediaOnline: integer("media_online"),
    mediaOffline: integer("media_offline"),
    oneOnOne: text("one_on_one"),
    keteranganOneOnOne: text("keterangan_one_on_one"),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", sekarang)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("laporan_anggota_laporan_anggota_unique").on(t.laporanId, t.anggotaId),
    check(
      "laporan_anggota_kehadiran_check",
      sql`${t.kehadiran} IS NULL OR ${t.kehadiran} IN ('Tepat Waktu', 'Terlambat < 15 Menit', 'Terlambat > 15 Menit', 'Sakit', 'Tanpa Keterangan')`,
    ),
    check(
      "laporan_anggota_one_on_one_check",
      sql`${t.oneOnOne} IS NULL OR ${t.oneOnOne} IN ('Pribadi', 'Sebelum Meeting Pekanan', 'Alpa')`,
    ),
    check(
      "laporan_anggota_media_online_check",
      sql`${t.mediaOnline} IS NULL OR ${t.mediaOnline} >= 0`,
    ),
    check(
      "laporan_anggota_media_offline_check",
      sql`${t.mediaOffline} IS NULL OR ${t.mediaOffline} >= 0`,
    ),
  ],
);

export const koreksiLaporan = pgTable(
  "koreksi_laporan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    laporanId: uuid("laporan_id")
      .notNull()
      .references(() => laporanPekan.id, { onDelete: "restrict" }),
    korektorId: uuid("korektor_id")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    alasan: text("alasan").notNull(),
    sebelum: jsonb("sebelum").notNull(),
    sesudah: jsonb("sesudah").notNull(),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
  },
  (t) => [
    index("koreksi_laporan_laporan_id_idx").on(t.laporanId),
    check("koreksi_laporan_alasan_check", sql`length(btrim(${t.alasan})) > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Iuran
// ---------------------------------------------------------------------------

export const nominalIuran = pgTable(
  "nominal_iuran",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nama: text("nama").notNull(),
    nominal: integer("nominal").notNull(),
    aktif: boolean("aktif").notNull().default(true),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
  },
  (t) => [check("nominal_iuran_nominal_check", sql`${t.nominal} >= 0`)],
);

export const pembayaranIuran = pgTable(
  "pembayaran_iuran",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    karyawanId: uuid("karyawan_id")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    bulan: date("bulan").notNull(),
    nominalIuranId: uuid("nominal_iuran_id")
      .notNull()
      .references(() => nominalIuran.id, { onDelete: "restrict" }),
    tanggalBayar: date("tanggal_bayar").notNull(),
    pencatatId: uuid("pencatat_id")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
  },
  (t) => [
    unique("pembayaran_iuran_karyawan_bulan_unique").on(t.karyawanId, t.bulan),
    check(
      "pembayaran_iuran_bulan_awal_bulan_check",
      sql`${t.bulan} = date_trunc('month', ${t.bulan})::date`,
    ),
    check(
      "pembayaran_iuran_bulan_lampau_check",
      sql`${t.bulan} <= date_trunc('month', ${hariIniWIB})::date`,
    ),
    check("pembayaran_iuran_tanggal_bayar_check", sql`${t.tanggalBayar} <= ${hariIniWIB}`),
  ],
);

// ---------------------------------------------------------------------------
// Klien & Follow-up
// ---------------------------------------------------------------------------

export const hasilFollowup = pgTable("hasil_followup", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: text("nama").notNull(),
  urutan: integer("urutan").notNull().default(0),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
});

export const klien = pgTable(
  "klien",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    karyawanId: uuid("karyawan_id")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    nama: text("nama").notNull(),
    kontak: text("kontak"),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", sekarang)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("klien_karyawan_id_idx").on(t.karyawanId)],
);

export const followup = pgTable(
  "followup",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    klienId: uuid("klien_id")
      .notNull()
      .references(() => klien.id, { onDelete: "restrict" }),
    tanggal: date("tanggal").notNull(),
    hasilFollowupId: uuid("hasil_followup_id")
      .notNull()
      .references(() => hasilFollowup.id, { onDelete: "restrict" }),
    deskripsi: text("deskripsi"),
    // Selalu pemilik klien: jumlah follow-up per pekan dihitung dari kolom ini.
    createdBy: uuid("created_by")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    // Diisi bila Atasan Supervisor yang mencatat/mengubah atas nama pemilik.
    pencatatSupervisorId: uuid("pencatat_supervisor_id").references(() => karyawan.id, {
      onDelete: "restrict",
    }),
    // Soft-delete: riwayat edit merujuk baris ini dengan RESTRICT, dan jejak
    // penghapusan tetap dibaca dari barisnya.
    deletedAt: timestamp("deleted_at", sekarang),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
  },
  (t) => [
    index("followup_klien_tanggal_idx").on(t.klienId, t.tanggal),
    index("followup_created_by_tanggal_idx").on(t.createdBy, t.tanggal),
    check("followup_tanggal_lampau_check", sql`${t.tanggal} <= ${hariIniWIB}`),
  ],
);

export const followupEdit = pgTable(
  "followup_edit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followupId: uuid("followup_id")
      .notNull()
      .references(() => followup.id, { onDelete: "restrict" }),
    editorId: uuid("editor_id")
      .notNull()
      .references(() => karyawan.id, { onDelete: "restrict" }),
    alasan: text("alasan").notNull(),
    sebelum: jsonb("sebelum").$type<Record<string, unknown>>().notNull(),
    sesudah: jsonb("sesudah").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", sekarang).notNull().defaultNow(),
  },
  (t) => [index("followup_edit_followup_id_idx").on(t.followupId)],
);
