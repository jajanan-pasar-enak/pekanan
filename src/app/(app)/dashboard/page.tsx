import { requireKaryawan } from "@/lib/auth/current";
import { pekanWIB } from "@/lib/waktu";

export default async function DashboardPage() {
  const { profil } = await requireKaryawan();
  const pekan = pekanWIB();

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold tracking-tight">Halo, {profil.nama}</h1>
      <p className="text-sm opacity-60">
        Pekan berjalan: {pekan.mulai} s.d. {pekan.selesai} WIB
      </p>
    </section>
  );
}
