// @ts-nocheck -- Node memuat TS tanpa transformasi tipe.
import assert from "node:assert/strict";
import { test } from "node:test";
import { alasanAlihDitolak, alasanNonaktifDitolak, ubahKaryawanSchema } from "./aturan";

test("ubahKaryawanSchema: minimal satu field perubahan", () => {
  assert.throws(() => ubahKaryawanSchema.parse({}));
  const ok = ubahKaryawanSchema.parse({ level: "Tetap", supervisorId: null });
  assert.deepEqual(ok, { level: "Tetap", supervisorId: null });
  assert.throws(() => ubahKaryawanSchema.parse({ level: "Kontrak" }));
  assert.throws(() => ubahKaryawanSchema.parse({ nama: "   " }));
});

test("alasanNonaktifDitolak: butuh tanpa anggota & tanpa klien", () => {
  assert.equal(alasanNonaktifDitolak({ anggota: 0, klien: 0 }), null);
  assert.match(alasanNonaktifDitolak({ anggota: 2, klien: 0 }) ?? "", /Anggota/);
  assert.match(alasanNonaktifDitolak({ anggota: 0, klien: 1 }) ?? "", /Klien/);
  const pesan = alasanNonaktifDitolak({ anggota: 1, klien: 1 }) ?? "";
  assert.match(pesan, /Anggota/);
  assert.match(pesan, /Klien/);
});

test("alasanNonaktifDitolak: Anggota boleh bila Draf naik ke atasan atau digantikan", () => {
  assert.equal(alasanNonaktifDitolak({ anggota: 2, klien: 0, anggotaBerkasAtasan: true }), null);
  assert.equal(alasanNonaktifDitolak({ anggota: 2, klien: 0, denganSupervisorBaru: true }), null);
  assert.match(
    alasanNonaktifDitolak({ anggota: 2, klien: 1, anggotaBerkasAtasan: true }) ?? "",
    /Klien/,
  );
});

test("alasanAlihDitolak: target harus ada, aktif, bukan pemilik sekarang", () => {
  assert.equal(alasanAlihDitolak(null, "a", "a"), "Karyawan tujuan tidak ditemukan.");
  assert.match(alasanAlihDitolak({ aktif: false }, "a", "a") ?? "", /nonaktif/);
  assert.match(alasanAlihDitolak({ aktif: true }, "a", "a") ?? "", /pemilik/);
  assert.equal(alasanAlihDitolak({ aktif: true }, "a", "b"), null);
});
