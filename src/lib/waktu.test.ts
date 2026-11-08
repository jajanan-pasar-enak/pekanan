// @ts-nocheck -- Node memuat TS tanpa transformasi tiper; .tsx milik Next diabaikan.
import assert from "node:assert/strict";
import { test } from "node:test";
import { awalPekan, bulanBerjalan, pekanWIB, tambahHari, tanggalHariIni } from "./waktu";

// WIB = UTC+7 tanpa DST.
const utc = (iso: string) => new Date(`${iso}Z`);

test("Sabtu 23:59:59 WIB masih pekan berjalan yang dimulai Minggu sebelumnya", () => {
  // Sabtu 7 Nov 2026 16:59:59 UTC = 23:59:59 WIB.
  assert.deepEqual(pekanWIB(utc("2026-11-07T16:59:59")), {
    mulai: "2026-11-01",
    selesai: "2026-11-07",
  });
});

test("Minggu 00:00 WIB mulai pekan baru", () => {
  // Sabtu 7 Nov 16:59:59.999 UTC = Sabtu 23:59:59.999 WIB; +1 ms = Minggu 00:00 WIB.
  assert.deepEqual(pekanWIB(utc("2026-11-07T16:59:59")), {
    mulai: "2026-11-01",
    selesai: "2026-11-07",
  });
  assert.deepEqual(pekanWIB(new Date(utc("2026-11-07T16:59:59.999").getTime() + 1)), {
    mulai: "2026-11-08",
    selesai: "2026-11-14",
  });
  assert.deepEqual(pekanWIB(utc("2026-11-07T17:00:00")), {
    mulai: "2026-11-08",
    selesai: "2026-11-14",
  });
});

test("Sabtu 23:59 WIB jatuh di tanggal WIB, bukan tanggal UTC", () => {
  // Sabtu 7 Nov 17:30 UTC = Minggu 8 Nov 00:30 WIB.
  assert.equal(tanggalHariIni(utc("2026-11-07T17:30:00")), "2026-11-08");
  // Jumat 6 Nov 16:59 UTC = Jumat 23:59 WIB.
  assert.equal(tanggalHariIni(utc("2026-11-06T16:59:00")), "2026-11-06");
  assert.equal(tanggalHariIni(utc("2026-11-06T17:00:00")), "2026-11-07");
});

test("pekan yang melintasi pergantian bulan", () => {
  // Minggu 25 Okt 2026 s.d. Sabtu 31 Okt 2026.
  assert.deepEqual(pekanWIB(utc("2026-10-28T03:00:00")), {
    mulai: "2026-10-25",
    selesai: "2026-10-31",
  });
  // Minggu 1 Nov 2026 s.d. Sabtu 7 Nov 2026.
  assert.deepEqual(pekanWIB(utc("2026-11-01T03:00:00")), {
    mulai: "2026-11-01",
    selesai: "2026-11-07",
  });
  // Pekan yang memuat pergantian bulan di tengah: Rabu 30 Des 2026 – Selasa 5 Jan 2027.
  assert.deepEqual(pekanWIB(utc("2027-01-02T03:00:00")), {
    mulai: "2026-12-27",
    selesai: "2027-01-02",
  });
});

test("pekan yang melintasi pergantian tahun", () => {
  // Kamis 31 Des 2026 23:59 WIB = 31 Des 16:59 UTC.
  assert.deepEqual(pekanWIB(utc("2026-12-31T16:59:00")), {
    mulai: "2026-12-27",
    selesai: "2027-01-02",
  });
  // Jumat 1 Jan 2027 00:00 WIB = 31 Des 2026 17:00 UTC.
  assert.deepEqual(pekanWIB(utc("2026-12-31T17:00:00")), {
    mulai: "2026-12-27",
    selesai: "2027-01-02",
  });
  // Minggu 3 Jan 2027 00:00 WIB.
  assert.deepEqual(pekanWIB(utc("2027-01-02T17:00:00")), {
    mulai: "2027-01-03",
    selesai: "2027-01-09",
  });
});

test("awalPekan dan tambahHari", () => {
  assert.equal(awalPekan("2026-11-07"), "2026-11-01");
  assert.equal(awalPekan("2026-11-01"), "2026-11-01");
  assert.equal(awalPekan("2026-11-08"), "2026-11-08");
  assert.equal(tambahHari("2026-11-07", 1), "2026-11-08");
  assert.equal(tambahHari("2026-12-31", 1), "2027-01-01");
  assert.equal(tambahHari("2027-01-01", -1), "2026-12-31");
  assert.equal(tambahHari("2026-11-01", 7), "2026-11-08");
});

test("bulanBerjalan memakai tanggal WIB dan selalu tanggal 1", () => {
  // 31 Okt 16:59 UTC = 31 Okt 23:59 WIB.
  assert.equal(bulanBerjalan(utc("2026-10-31T16:59:00")), "2026-10-01");
  // 31 Okt 17:00 UTC = 1 Nov 00:00 WIB.
  assert.equal(bulanBerjalan(utc("2026-10-31T17:00:00")), "2026-11-01");
  assert.equal(bulanBerjalan(utc("2026-12-31T17:00:00")), "2027-01-01");
});
