import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { FormKoreksi } from "@/components/form-koreksi";
import { HalamanSkeleton, KartuSkeleton, KartuTabelSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireKaryawan } from "@/lib/auth/current";
import { AppError } from "@/lib/http";
import { getLaporan } from "@/lib/laporan/queries";

async function IsiKoreksi({ id }: { id: string }) {
  await connection();
  const { profil } = await requireKaryawan();
  let laporan;
  try {
    laporan = await getLaporan(id, profil.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  if (!laporan.bolehKoreksi) redirect(`/laporan/${laporan.id}`);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Koreksi Laporan</h1>
          <p className="text-sm text-muted-foreground">
            {laporan.pekan.mulai} s.d. {laporan.pekan.selesai} WIB · Supervisor:{" "}
            {laporan.supervisor.nama}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/laporan/${laporan.id}`}>Batal</Link>
        </Button>
      </header>
      <Card>
        <CardContent>
          <FormKoreksi laporanId={laporan.id} barisAwal={laporan.baris} />
        </CardContent>
      </Card>
    </>
  );
}

export default async function KoreksiPage({
  params,
}: PageProps<"/laporan/[id]/koreksi">) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <HalamanSkeleton
          anak={<KartuSkeleton judul="Isi koreksi" anak={<KartuTabelSkeleton />} />}
        />
      }
    >
      <IsiKoreksi id={id} />
    </Suspense>
  );
}
