// @ts-nocheck -- Node memuat TS tanpa transformasi tipe.
import assert from "node:assert/strict";
import { test } from "node:test";
import { klienSchema, followupSchema, tanggalFollowupSah } from "./aturan";

test("tanggalFollowupSah: hari ini dan lampau boleh, besok ditolak", () => {
  assert.equal(tanggalFollowupSah("2026-11-07", "2026-11-07"), true);
  assert.equal(tanggalFollowupSah("2026-10-01", "2026-11-07"), true);
  assert.equal(tanggalFollowupSah("2026-11-08", "2026-11-07"), false);
});

test("klienSchema: nama wajib, kontak boleh kosong menjadi null", () => {
  const ok = klienSchema.parse({ nama: "  Budi  ", kontak: "" });
  assert.equal(ok.nama, "Budi");
  assert.equal(ok.kontak, null);
  assert.throws(() => klienSchema.parse({ nama: "   " }));
});

test("followupSchema: tanggal harus ISO, hasil_followup_id harus uuid, deskripsi nullable", () => {
  const id = "3f2a1c9e-1111-4222-8333-444455556666";
  const ok = followupSchema.parse({
    tanggal: "2026-11-01",
    hasilFollowupId: id,
    deskripsi: "",
  });
  assert.equal(ok.hasilFollowupId, id);
  assert.equal(ok.deskripsi, null);

  assert.throws(() => followupSchema.parse({ tanggal: "2026-13-01", hasilFollowupId: id }));
  assert.throws(() => followupSchema.parse({ tanggal: "2026-11-01", hasilFollowupId: "x" }));
});
