import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barisLengkap,
  kolomKosong,
  normalisasiPatch,
  patchBarisSchema,
  nilaiBarisKosong,
} from "./aturan";

const lengkap = {
  kehadiran: "Tepat Waktu",
  keteranganHadir: null,
  mediaOnline: 3,
  mediaOffline: 0,
  oneOnOne: "Alpa",
  keteranganOneOnOne: null,
};

test("baris kosong: semua kolom wajib kosong", () => {
  assert.deepEqual(
    kolomKosong(nilaiBarisKosong()).sort(),
    ["kehadiran", "mediaOffline", "mediaOnline", "oneOnOne"].sort(),
  );
  assert.equal(barisLengkap(nilaiBarisKosong()), false);
});

test("baris lengkap meski keterangan kosong; 0 dihitung terisi", () => {
  assert.deepEqual(kolomKosong(lengkap), []);
  assert.equal(barisLengkap(lengkap), true);
  assert.equal(barisLengkap({ ...lengkap, mediaOnline: null }), false);
});

test("patchBarisSchema menerima nilai sah dan menolak nilai di luar himpunan", () => {
  assert.equal(
    patchBarisSchema.safeParse({ kehadiran: "Terlambat < 15 Menit", mediaOnline: 0 }).success,
    true,
  );
  assert.equal(patchBarisSchema.safeParse({ kehadiran: "Terlambat" }).success, false);
  assert.equal(patchBarisSchema.safeParse({ oneOnOne: "Telepon" }).success, false);
  assert.equal(patchBarisSchema.safeParse({ mediaOnline: -1 }).success, false);
  assert.equal(patchBarisSchema.safeParse({ mediaOffline: 1.5 }).success, false);
});

test("normalisasiPatch: undefined dibuang, string kosong jadi null", () => {
  assert.deepEqual(
    normalisasiPatch({
      kehadiran: "Sakit",
      keteranganHadir: "   ",
      mediaOnline: undefined,
      oneOnOne: null,
    }),
    { kehadiran: "Sakit", keteranganHadir: null, oneOnOne: null },
  );
});
