import { connection } from "next/server";
import { requireKaryawan } from "@/lib/auth/current";
import { unduhanCsv } from "@/lib/csv";
import { handle } from "@/lib/http";
import { duaBelasBulan, labelBulanPendek } from "@/lib/iuran/label";
import { rekapIuranBanyak } from "@/lib/iuran/queries";
import { daftarAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { bulanBerjalan } from "@/lib/waktu";

// Ledger 12 bulan untuk diri sendiri dan Anggota Langsung, sama seperti
// tampilan /iuran. Nominal kosong berarti bulan itu belum dibayar.
export async function GET() {
  return handle(async () => {
    await connection();
    const { profil } = await requireKaryawan();
    const berjalan = bulanBerjalan();
    const bulan = duaBelasBulan(berjalan);
    const dariBulan = bulan[bulan.length - 1]!;

    const anggota = await daftarAnggotaLangsung(profil.id);
    const orang = [
      { id: profil.id, nama: `${profil.nama} (saya)` },
      ...anggota.map((a) => ({ id: a.id, nama: a.nama })),
    ];
    const peta = await rekapIuranBanyak(
      orang.map((o) => o.id),
      dariBulan,
      berjalan,
    );

    const baris = [
      ["Karyawan", ...bulan.map(labelBulanPendek), "Lunas"],
      ...orang.map((o) => {
        const rekap = peta.get(o.id) ?? [];
        return [
          o.nama,
          ...bulan.map((b) => {
            const isi = rekap.find((r) => r.bulan === b);
            return isi?.lunas ? isi.nominal : "";
          }),
          `${rekap.filter((r) => r.lunas).length}/${rekap.length}`,
        ];
      }),
    ];

    return unduhanCsv(baris, `ledger-iuran-${berjalan.slice(0, 7)}.csv`);
  });
}
