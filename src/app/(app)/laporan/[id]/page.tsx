import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { FormLaporan } from "@/components/form-laporan";
import { HalamanSkeleton, IsiKartuSkeleton, KartuSkeleton } from "@/components/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { AppError } from "@/lib/http";
import { daftarFollowupPekan } from "@/lib/klien/followup";
import { daftarHasilFollowup } from "@/lib/klien/queries";
import { getLaporan } from "@/lib/laporan/queries";
import { ringkasPerubahan } from "@/lib/laporan/koreksi";
import { tanggalHariIni, formatRentangTanggal, formatTanggalWaktu } from "@/lib/waktu";

async function IsiLaporan({ id }: { id: string }) {
  await connection();
  const { profil } = await requireKaryawanHalaman();
  let laporan;
  try {
    laporan = await getLaporan(id, profil.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const [konteksFollowup, opsiHasil] = await Promise.all([
    daftarFollowupPekan(laporan.supervisor.id, laporan.pekan, profil.id),
    daftarHasilFollowup(true),
  ]);
  const namaAnggota = new Map(laporan.baris.map((b) => [b.anggotaId, b.nama]));
  const bisaKirim = laporan.bolehUbah && laporan.status === "Draf";

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Laporan Pekan</h1>
            <Badge
              variant={laporan.status === "Draf" ? "secondary" : "outline"}
              className={
                laporan.status === "Terkirim"
                  ? "border-signal/25 bg-signal/10 font-medium text-signal"
                  : undefined
              }
            >
              {laporan.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatRentangTanggal(laporan.pekan.mulai, laporan.pekan.selesai)} WIB
          </p>
          <p className="text-sm text-muted-foreground">
            Supervisor: {laporan.supervisor.nama}.{" "}
            {laporan.pekanBerjalan ? "Pekan berjalan." : "Pekan lampau."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Kembali</Link>
          </Button>
          {laporan.bolehKoreksi && (
            <Button variant={bisaKirim ? "outline" : "default"} asChild>
              <Link href={`/laporan/${laporan.id}/koreksi`}>Koreksi</Link>
            </Button>
          )}
        </div>
      </header>

      {laporan.baris.length === 0 ? (
        <p className="text-sm text-muted-foreground">Laporan tidak punya baris anggota.</p>
      ) : (
        <FormLaporan
          key={`${laporan.status}:${laporan.bolehUbah}`}
          laporanId={laporan.id}
          bolehUbah={laporan.bolehUbah}
          status={laporan.status}
          barisAwal={laporan.baris}
          hariIni={tanggalHariIni()}
          konteksFollowup={konteksFollowup}
          opsiHasil={opsiHasil.map((h) => ({ id: h.id, nama: h.nama }))}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Koreksi</CardTitle>
          <CardDescription>
            {laporan.koreksi.length === 0
              ? "Belum ada koreksi dari atasan."
              : `${laporan.koreksi.length} koreksi tercatat.`}
          </CardDescription>
        </CardHeader>
        {laporan.koreksi.length > 0 && (
          <CardContent className="flex flex-col gap-4">
            {laporan.koreksi.map((k) => (
              <div key={k.id} className="flex flex-col gap-1 border-l-2 pl-3">
                <p className="text-sm">
                  <span className="font-medium">{k.korektor}</span>{" "}
                  <span className="text-muted-foreground">{formatTanggalWaktu(k.createdAt)}</span>
                </p>
                <p className="text-sm">{k.alasan}</p>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {ringkasPerubahan(k.sebelum, k.sesudah, namaAnggota).map((d) => (
                    <li key={d.anggotaId}>
                      <span className="font-medium">{d.nama}</span>
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {d.perubahan.map((p) => (
                          <li key={p.kolom}>
                            {p.label}: dari {p.sebelum} menjadi {p.sesudah}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </>
  );
}

export default async function LaporanPage({ params }: PageProps<"/laporan/[id]">) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <HalamanSkeleton
          judul="Laporan Pekan"
          aksi={
            <Button variant="outline" asChild>
              <Link href="/dashboard">Kembali</Link>
            </Button>
          }
          anak={
            <>
              <KartuSkeleton anak={<IsiKartuSkeleton />} />
              <KartuSkeleton judul="Riwayat Koreksi" anak={<IsiKartuSkeleton />} />
            </>
          }
        />
      }
    >
      <IsiLaporan id={id} />
    </Suspense>
  );
}
