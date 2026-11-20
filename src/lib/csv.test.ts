import assert from "node:assert/strict";
import { test } from "node:test";
import { csv, unduhanCsv } from "./csv";

test("sel kosong dan angka ditulis apa adanya", () => {
  assert.equal(csv([[null, undefined, 0, 12]]), ",,0,12\r\n");
});

test("koma, kutip, dan baris baru di-escape", () => {
  assert.equal(csv([["a,b"]]), '"a,b"\r\n');
  assert.equal(csv([['kata "kutip"']]), '"kata ""kutip"""\r\n');
  assert.equal(csv([["baris\nbaru"]]), '"baris\nbaru"\r\n');
});

test("teks berawalan formula tidak dieksekusi spreadsheet", () => {
  for (const teks of ["=1+1", "+62 812", "-5", "@nama", "  =SUM(A1)", "\t=1"]) {
    const hasil = csv([[teks]]);
    assert.ok(hasil.startsWith("'"), `${teks} → ${hasil}`);
    assert.ok(hasil.includes(teks), teks);
  }
});

test("unduhan memakai header unduhan dan BOM", async () => {
  const res = unduhanCsv(
    [
      ["Nama", "Jumlah"],
      ["Ani", 2],
    ],
    "rekap 2026-11-15.csv",
  );
  assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(
    res.headers.get("content-disposition"),
    'attachment; filename="rekap-2026-11-15.csv"',
  );
  // WHATWG Response.text() membuang BOM, jadi BOM diperiksa dari byte mentah.
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(new TextDecoder().decode(bytes.slice(3)), "Nama,Jumlah\r\nAni,2\r\n");
});
