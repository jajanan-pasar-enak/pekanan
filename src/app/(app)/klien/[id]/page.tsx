import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { FormFollowup } from "@/components/form-followup";
import { BarisTabelSkeleton, HalamanSkeleton, KartuSkeleton } from "@/components/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { AppError } from "@/lib/http";
import { daftarHasilFollowup, getKlien } from "@/lib/klien/queries";
import { formatTanggal, formatTanggalWaktu, tanggalHariIni } from "@/lib/waktu";

async function IsiKlien({ id }: { id: string }) {
  await connection();
  const { profil } = await requireKaryawanHalaman();
  let klien;
  try {
    klien = await getKlien(id, profil.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const opsiHasil = klien.bolehCatat ? await daftarHasilFollowup(true) : [];

  type BarisRiwayat = {
    id: string;
    tanggal: string;
    hasil: string;
    deskripsi: string | null;
    oleh: string;
    edit: (typeof klien.followup)[number]["edit"];
    dihapus: { oleh: string; alasan: string | null; pada: Date | null } | null;
  };
  const riwayat: BarisRiwayat[] = [
    ...klien.followup.map((f) => ({
      id: f.id,
      tanggal: f.tanggal,
      hasil: f.hasil.nama,
      deskripsi: f.deskripsi,
      oleh: f.olehSupervisor
        ? `${f.olehSupervisor.nama} (atas nama ${f.pencatat.nama})`
        : f.pencatat.nama,
      edit: f.edit,
      dihapus: null,
    })),
    ...klien.dihapus.map((d) => ({
      id: d.id,
      tanggal: d.tanggal,
      hasil: d.hasil.nama,
      deskripsi: d.deskripsi,
      oleh: d.pencatat.nama,
      edit: [],
      dihapus: { oleh: d.oleh?.nama ?? "pengguna", alasan: d.alasan, pada: d.dihapusPada },
    })),
  ].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{`${klien.nama}`}</h1>
            {!klien.bolehCatat && <Badge variant="outline">hanya baca</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Kontak: {klien.kontak ?? "belum diisi"}. Pemilik: {klien.pemilik.nama}.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/klien">Kembali</Link>
        </Button>
      </header>

      {klien.bolehCatat && (
        <Card>
          <CardHeader>
            <CardTitle>Catat follow-up</CardTitle>
            <CardDescription>
              Satu catatan = satu kejadian bertanggal. Dicatat atas nama {klien.pemilik.nama}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormFollowup klienId={klien.id} hariIni={tanggalHariIni()} opsiHasil={opsiHasil} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat follow-up</CardTitle>
          <CardDescription>
            {klien.followup.length} kejadian
            {klien.dihapus.length > 0 ? `, ${klien.dihapus.length} dihapus` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {riwayat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada follow-up.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Hasil</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Dicatat oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riwayat.map((f) => (
                  <TableRow key={f.id} className={f.dihapus ? "text-muted-foreground" : undefined}>
                    <TableCell className="whitespace-nowrap">
                      <span className={f.dihapus ? "line-through" : undefined}>
                        {formatTanggal(f.tanggal)}
                      </span>
                      {f.dihapus && (
                        <Badge variant="outline" className="ml-2">
                          dihapus
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={f.dihapus ? "line-through" : undefined}>
                      {f.hasil}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.deskripsi ?? "Belum diisi"}
                      {f.dihapus ? (
                        <p className="mt-1 text-xs">
                          {`Dihapus${f.dihapus.pada ? ` ${formatTanggalWaktu(f.dihapus.pada)}` : ""} oleh ${f.dihapus.oleh}${f.dihapus.alasan ? `: ${f.dihapus.alasan}` : ""}.`}
                        </p>
                      ) : (
                        f.edit.length > 0 && (
                          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                            {f.edit.map((e) => (
                              <li key={e.id}>
                                diubah {e.editor.nama}: {e.alasan}
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                    </TableCell>
                    <TableCell>{f.oleh}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default async function KlienDetailPage({ params }: PageProps<"/klien/[id]">) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <HalamanSkeleton
          aksi={
            <Button variant="outline" asChild>
              <Link href="/klien">Kembali</Link>
            </Button>
          }
          anak={<KartuSkeleton judul="Riwayat follow-up" anak={<BarisTabelSkeleton />} />}
        />
      }
    >
      <IsiKlien id={id} />
    </Suspense>
  );
}
