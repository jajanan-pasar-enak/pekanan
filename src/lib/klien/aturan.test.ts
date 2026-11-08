// @ts-nocheck -- Node memuat TS tanpa transformasi tipe.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bolehKelolaFollowup,
  diffFollowup,
  followupSchema,
  hapusFollowupSchema,
  klienSchema,
  tanggalFollowupSah,
  ubahFollowupSchema,
} from "./aturan";

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

test("ubahFollowupSchema: alasan wajib dan di-trim, deskripsi kosong menjadi null", () => {
  const id = "3f2a1c9e-1111-4222-8333-444455556666";
  const ok = ubahFollowupSchema.parse({
    tanggal: "2026-11-02",
    hasilFollowupId: id,
    deskripsi: "  ",
    alasan: "  salah input hasil  ",
  });
  assert.equal(ok.alasan, "salah input hasil");
  assert.equal(ok.deskripsi, null);
  assert.throws(() =>
    ubahFollowupSchema.parse({ tanggal: "2026-11-02", hasilFollowupId: id, alasan: "   " }),
  );
});

test("diffFollowup: hanya kolom yang berubah, null dan string kosong dianggap sama", () => {
  const idA = "3f2a1c9e-1111-4222-8333-444455556666";
  const idB = "3f2a1c9e-1111-4222-8333-444455556667";
  const awal = { tanggal: "2026-11-02", hasilFollowupId: idA, deskripsi: null };

  assert.deepEqual(diffFollowup(awal, { ...awal }), {});
  assert.deepEqual(
    diffFollowup(awal, { tanggal: "2026-11-03", hasilFollowupId: idA, deskripsi: null }),
    { tanggal: "2026-11-03" },
  );
  assert.deepEqual(
    diffFollowup(awal, { tanggal: "2026-11-02", hasilFollowupId: idB, deskripsi: "hubungi lagi" }),
    { hasilFollowupId: idB, deskripsi: "hubungi lagi" },
  );
});

test("hapusFollowupSchema: alasan wajib dan di-trim", () => {
  assert.deepEqual(hapusFollowupSchema.parse({ alasan: "  salah klien  " }), {
    alasan: "salah klien",
  });
  assert.throws(() => hapusFollowupSchema.parse({ alasan: "   " }));
  assert.throws(() => hapusFollowupSchema.parse({}));
});

test("bolehKelolaFollowup: pemilik dan Atasan Supervisor langsung pemilik saja", () => {
  const pemilik = { id: "anggota", supervisorId: "sari" };
  assert.equal(bolehKelolaFollowup("anggota", pemilik), true);
  assert.equal(bolehKelolaFollowup("sari", pemilik), true);
  assert.equal(bolehKelolaFollowup("tono", pemilik), false);
  assert.equal(bolehKelolaFollowup("anggota", { id: "anggota", supervisorId: null }), true);
  assert.equal(bolehKelolaFollowup("sari", { id: "anggota", supervisorId: null }), false);
});
