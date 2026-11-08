import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { FormLaporan } from "@/components/form-laporan";
import {
  BarisTabelSkeleton,
  HalamanSkeleton,
  IsiKartuSkeleton,
  KartuSkeleton,
} from "@/components/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireKaryawan } from "@/lib/auth/current";
import { AppError } from "@/lib/http";
import { daftarFollowupPekan } from "@/lib/klien/followup";
import { daftarHasilFollowup } from "@/lib/klien/queries";
import { getLaporan } from "@/lib/laporan/queries";
import { tanggalHariIni } from "@/lib/waktu";

type BarisKoreksi = Record<string, unknown>;

function teksNilai(v: unknown): string {
  if (v === null || v === undefined || v === "") return "kosong";
  return String(v);
}

function ringkasDiff(sebelum: unknown, sesudah: unknown, namaAnggota: Map<string, string>) {
  const a = (sebelum ?? {}) as Record<string, BarisKoreksi>;
  const b = (sesudah ?? {}) as Record<string, BarisKoreksi>;
  return Object.keys(b).map((anggotaId) => ({
    anggotaId,
    nama: namaAnggota.get(anggotaId) ?? anggotaId,
    kolom: Object.keys(b[anggotaId] ?? {}).filter(
      (k) => JSON.stringify(a[anggotaId]?.[k]) !== JSON.stringify(b[anggotaId]?.[k]),
    ),
    sebelum: a[anggotaId] ?? {},
    sesudah: b[anggotaId] ?? {},
  }));
}

async function IsiLaporan({ id }: { id: string }) {
  await connection();
  const { profil } = await requireKaryawan();
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

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Laporan Pekan</h1>
            <Badge
              variant={
                laporan.status === "Terkirim"
                  ? "default"
                  : laporan.status === "Dikoreksi"
                    ? "outline"
                    : "secondary"
              }
            >
              {laporan.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {laporan.pekan.mulai} s.d. {laporan.pekan.selesai} WIB · Supervisor:{" "}
            {laporan.supervisor.nama}
            {laporan.pekanBerjalan ? " · pekan berjalan" : " · pekan lampau"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Kembali</Link>
          </Button>
          {laporan.bolehKoreksi && (
            <Button asChild>
              <Link href={`/laporan/${laporan.id}/koreksi`}>Koreksi</Link>
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent>
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
        </CardContent>
      </Card>

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
                  <span className="text-muted-foreground">
                    · {new Date(k.createdAt).toLocaleString("id-ID")}
                  </span>
                </p>
                <p className="text-sm">{k.alasan}</p>
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {ringkasDiff(k.sebelum, k.sesudah, namaAnggota).map((d) => (
                    <li key={d.anggotaId}>
                      <span className="font-medium">{d.nama}</span>:{" "}
                      {d.kolom
                        .map(
                          (kolom) =>
                            `${kolom} ${teksNilai(d.sebelum[kolom])} → ${teksNilai(d.sesudah[kolom])}`,
                        )
                        .join("; ")}
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
              <KartuSkeleton anak={<BarisTabelSkeleton jumlahBaris={6} />} />
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
