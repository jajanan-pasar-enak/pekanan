import assert from "node:assert/strict";
import { test } from "node:test";
import { duaBelasBulan, labelBulan, labelBulanPendek } from "./label";

test("label bulan panjang dan pendek memakai Bahasa Indonesia", () => {
  assert.equal(labelBulan("2026-11-01"), "November 2026");
  assert.equal(labelBulanPendek("2026-11-01"), "Nov 2026");
});

test("dua belas bulan berurutan mundur dan melewati batas tahun", () => {
  const bulan = duaBelasBulan("2026-02-01");
  assert.equal(bulan.length, 12);
  assert.equal(bulan[0], "2026-02-01");
  assert.equal(bulan[11], "2025-03-01");
  assert.equal(new Set(bulan).size, 12);
});
