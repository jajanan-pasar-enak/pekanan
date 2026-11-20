export type NilaiCsv = string | number | null | undefined;

// Sel teks yang diawali karakter formula dibungkus apostrof agar spreadsheet
// tidak mengeksekusinya. Angka asli (number) tidak disentuh.
function sel(nilai: NilaiCsv): string {
  if (nilai === null || nilai === undefined) return "";
  let teks = String(nilai);
  if (typeof nilai === "string" && /^[\s]*[=+\-@\t\r]/.test(teks)) teks = `'${teks}`;
  if (/[",\r\n]/.test(teks)) teks = `"${teks.replaceAll('"', '""')}"`;
  return teks;
}

export function csv(baris: NilaiCsv[][]): string {
  if (baris.length === 0) return "";
  return `${baris.map((b) => b.map(sel).join(",")).join("\r\n")}\r\n`;
}

// BOM di awal menjaga huruf beraksen dan karakter non-ASCII tetap terbaca di
// Excel; berkas tetap CSV biasa untuk pengolah lain.
export function unduhanCsv(baris: NilaiCsv[][], namaBerkas: string): Response {
  const nama = namaBerkas.replace(/[^\w.-]/g, "-");
  return new Response(`\uFEFF${csv(baris)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nama}"`,
      "cache-control": "no-store",
    },
  });
}
