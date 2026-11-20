import assert from "node:assert/strict";
import { test } from "node:test";
import { ringkasPerubahan, teksNilai } from "./koreksi";

const nama = new Map([
  ["a", "Ani"],
  ["b", "Budi"],
]);

test("nilai kosong ditulis jelas; nol tetap nol", () => {
  assert.equal(teksNilai(null), "belum diisi");
  assert.equal(teksNilai(undefined), "belum diisi");
  assert.equal(teksNilai(""), "belum diisi");
  assert.equal(teksNilai(0), "0");
  assert.equal(teksNilai("Sakit"), "Sakit");
});

test("ringkasPerubahan memakai label ramah dan urutan kolom tetap", () => {
  const hasil = ringkasPerubahan(
    { a: { kehadiran: "Sakit", mediaOnline: 1, keteranganHadir: null } },
    {
      a: {
        keteranganHadir: "Surat dokter",
        mediaOnline: 1,
        kehadiran: "Tepat Waktu",
      },
    },
    nama,
  );

  assert.deepEqual(hasil, [
    {
      anggotaId: "a",
      nama: "Ani",
      perubahan: [
        {
          kolom: "kehadiran",
          label: "Kehadiran",
          sebelum: "Sakit",
          sesudah: "Tepat Waktu",
        },
        {
          kolom: "keteranganHadir",
          label: "Keterangan kehadiran",
          sebelum: "belum diisi",
          sesudah: "Surat dokter",
        },
      ],
    },
  ]);
});

test("anggota tanpa perubahan dilewati dan hasil diurutkan menurut nama", () => {
  const hasil = ringkasPerubahan(
    {
      a: { mediaOnline: 1 },
      b: { mediaOnline: 2 },
    },
    {
      b: { mediaOnline: 3 },
      a: { mediaOnline: 1 },
    },
    nama,
  );

  assert.deepEqual(hasil, [
    {
      anggotaId: "b",
      nama: "Budi",
      perubahan: [
        {
          kolom: "mediaOnline",
          label: "Media online",
          sebelum: "2",
          sesudah: "3",
        },
      ],
    },
  ]);
});

test("kunci tak dikenal tetap tampil dengan nilai mentahnya", () => {
  const hasil = ringkasPerubahan({ a: { kolomBaru: "lama" } }, { a: { kolomBaru: "baru" } }, nama);

  assert.deepEqual(hasil[0]?.perubahan, [
    { kolom: "kolomBaru", label: "kolomBaru", sebelum: "lama", sesudah: "baru" },
  ]);
});
