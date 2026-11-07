import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  KelolaKaryawan,
  type KaryawanAdmin,
} from "@/components/admin/kelola-karyawan";
import { KelolaKlien } from "@/components/admin/kelola-klien";
import { MasterHasilFollowup } from "@/components/admin/master-hasil-followup";
import { MasterNominalIuran } from "@/components/admin/master-nominal-iuran";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireKaryawan } from "@/lib/auth/current";
import { daftarHasilFollowup } from "@/lib/klien/queries";
import { daftarNominalIuran } from "@/lib/iuran/queries";
import { daftarKaryawan } from "@/lib/kepegawaian/queries";

async function IsiAdmin() {
  await connection();
  const { sesi, profil } = await requireKaryawan();
  if (sesi.user.role !== "admin") redirect("/dashboard");

  const [karyawan, nominal, hasil] = await Promise.all([
    daftarKaryawan(),
    daftarNominalIuran(),
    daftarHasilFollowup(),
  ]);
  const dataKaryawan: KaryawanAdmin[] = karyawan.map((k) => ({
    id: k.id,
    nama: k.nama,
    email: k.email,
    level: k.level === "Magang" ? "Magang" : "Tetap",
    supervisorId: k.supervisorId,
    supervisorNama: k.supervisorNama,
    aktif: k.aktif,
    harusGantiPassword: k.harusGantiPassword,
    peran: k.peran,
    anggotaLangsung: k.anggotaLangsung,
    klien: k.klien,
  }));
  const kandidatSupervisor = dataKaryawan
    .filter((k) => k.aktif && k.level === "Tetap")
    .map((k) => ({ id: k.id, nama: k.nama }));
  const kandidatPemilikKlien = dataKaryawan
    .filter((k) => k.aktif)
    .map((k) => ({ id: k.id, nama: k.nama }));

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Karyawan, Pengambilalihan Klien, master iuran, dan master hasil follow-up.
        </p>
      </header>

      <Tabs defaultValue="karyawan">
        <TabsList>
          <TabsTrigger value="karyawan">Karyawan</TabsTrigger>
          <TabsTrigger value="klien">Klien</TabsTrigger>
          <TabsTrigger value="nominal">Nominal Iuran</TabsTrigger>
          <TabsTrigger value="hasil">Hasil Follow-up</TabsTrigger>
        </TabsList>
        <TabsContent value="karyawan">
          <KelolaKaryawan
            karyawan={dataKaryawan}
            kandidatSupervisor={kandidatSupervisor}
            sayaId={profil.id}
          />
        </TabsContent>
        <TabsContent value="klien">
          <KelolaKlien karyawan={kandidatPemilikKlien} />
        </TabsContent>
        <TabsContent value="nominal">
          <MasterNominalIuran nominal={nominal} />
        </TabsContent>
        <TabsContent value="hasil">
          <MasterHasilFollowup hasil={hasil} />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <IsiAdmin />
    </Suspense>
  );
}
