import { connection } from "next/server";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";
import { bootstrapPekan, daftarAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { daftarLaporanSaya } from "@/lib/laporan/queries";

export async function POST() {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    await bootstrapPekan(profil.id);
    const [anggota, laporan] = await Promise.all([
      daftarAnggotaLangsung(profil.id),
      daftarLaporanSaya(profil.id),
    ]);
    return jsonOk({ anggotaLangsung: anggota.length, laporan });
  });
}
