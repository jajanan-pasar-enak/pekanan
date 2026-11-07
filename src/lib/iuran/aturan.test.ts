// @ts-nocheck -- Node memuat TS tanpa transformasi tipe.
import assert from "node:assert/strict";
import { test } from "node:test";
import { alasanBulanDitolak, bulanSah, pembayaranIuranSchema } from "./aturan";

test("alasanBulanDitolak: bulan berjalan & lampau boleh, bulan depan ditolak", () => {
  assert.equal(alasanBulanDitolak("2026-11-01", "2026-11-01"), null);
  assert.equal(alasanBulanDitolak("2026-01-01", "2026-11-01"), null);
  assert.match(alasanBulanDitolak("2026-12-01", "2026-11-01") ?? "", /mendatang/);
});

test("alasanBulanDitolak: bukan tanggal 1 awal bulan ditolak", () => {
  assert.match(alasanBulanDitolak("2026-11-02", "2026-11-01") ?? "", /awal bulan/);
});

test("bulanSah: format YYYY-MM-01 saja", () => {
  assert.equal(bulanSah("2026-02-01"), true);
  assert.equal(bulanSah("2026-02-10"), false);
  assert.equal(bulanSah("2026-2-01"), false);
  assert.equal(bulanSah("2026-13-01"), false);
});

test("pembayaranIuranSchema: tanggalBayar opsional, bulan wajib ISO date", () => {
  const id = "3f2a1c9e-1111-4222-8333-444455556666";
  const ok = pembayaranIuranSchema.parse({ nominalIuranId: id, bulan: "2026-11-01" });
  assert.equal(ok.tanggalBayar, undefined);
  const explicit = pembayaranIuranSchema.parse({
    nominalIuranId: id,
    bulan: "2026-11-01",
    tanggalBayar: "2026-11-05",
  });
  assert.equal(explicit.tanggalBayar, "2026-11-05");
  assert.throws(() => pembayaranIuranSchema.parse({ nominalIuranId: id, bulan: "2026-11" }));
});
