import assert from "node:assert/strict";
import { test } from "node:test";
import { nilaiBarisKosong } from "./aturan";
import { kolomAkhir, kolomAwal, labelKolom, ringkasGap } from "./label";

const lengkap = {
  kehadiran: "Tepat Waktu",
  keteranganHadir: "Catatan",
  mediaOnline: 3,
  mediaOffline: 0,
  oneOnOne: "Pribadi",
  keteranganOneOnOne: null,
};

test("label kolom memakai Bahasa Indonesia dan fallback ke kunci asli", () => {
  assert.equal(labelKolom("mediaOnline"), "Media online");
  assert.equal(labelKolom("oneOnOne"), "One-on-one");
  assert.equal(labelKolom("keteranganOneOnOne"), "Keterangan one-on-one");
  assert.equal(labelKolom("kolomBaru"), "kolomBaru");
});

test("ringkasGap hanya memuat anggota yang belum lengkap", () => {
  const gap = ringkasGap([
    { anggotaId: "a", nama: "Ani", nilai: { ...nilaiBarisKosong() } },
    { anggotaId: "b", nama: "Budi", nilai: lengkap },
    {
      anggotaId: "c",
      nama: "Citra",
      nilai: { ...lengkap, mediaOnline: null, oneOnOne: null },
    },
  ]);

  assert.deepEqual(gap, [
    {
      anggotaId: "a",
      nama: "Ani",
      kolom: ["kehadiran", "mediaOnline", "mediaOffline", "oneOnOne"],
      label: "Kehadiran, Media online, Media offline, One-on-one",
    },
    {
      anggotaId: "c",
      nama: "Citra",
      kolom: ["mediaOnline", "oneOnOne"],
      label: "Media online, One-on-one",
    },
  ]);
});

test("kolomAwal dan kolomAkhir mengikuti kolom wajib yang kosong", () => {
  assert.equal(kolomAwal(nilaiBarisKosong()), "kehadiran");
  assert.equal(kolomAkhir(nilaiBarisKosong()), "oneOnOne");
  assert.equal(kolomAwal({ ...lengkap, kehadiran: null, mediaOnline: null }), "kehadiran");
  assert.equal(kolomAkhir({ ...lengkap, mediaOnline: null, oneOnOne: null }), "oneOnOne");
  assert.equal(kolomAwal(lengkap), "kehadiran");
  assert.equal(kolomAkhir(lengkap), "keteranganOneOnOne");
});
