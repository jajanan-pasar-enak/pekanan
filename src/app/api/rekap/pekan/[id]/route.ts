import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { unduhanCsv } from "@/lib/csv";
import { handle, jsonOk } from "@/lib/http";
import { getRekapPekan } from "@/lib/kepegawaian/queries";

const idSchema = z.uuid();

export async function GET(request: Request, { params }: RouteContext<"/api/rekap/pekan/[id]">) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { sesi, profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    const rekap = await getRekapPekan(id, {
      karyawanId: profil.id,
      admin: sesi.user.role === "admin",
    });

    if (new URL(request.url).searchParams.get("format") === "csv") {
      const baris = [
        ["Anggota", "Kehadiran", "Media online", "Media offline", "One-on-one", "Follow-up"],
        ...rekap.baris.map((b) => [
          b.nama,
          b.kehadiran ?? "Belum diisi",
          b.mediaOnline,
          b.mediaOffline,
          b.oneOnOne ?? "Belum diisi",
          b.followup,
        ]),
        [
          "Total",
          `${rekap.total.lengkap}/${rekap.total.anggota} baris lengkap`,
          rekap.total.mediaOnline,
          rekap.total.mediaOffline,
          "",
          rekap.total.followup,
        ],
      ];
      return unduhanCsv(baris, `rekap-${rekap.pekan.mulai}.csv`);
    }

    return jsonOk(rekap);
  });
}
