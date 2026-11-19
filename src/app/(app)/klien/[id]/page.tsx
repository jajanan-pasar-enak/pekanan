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
import { tanggalHariIni } from "@/lib/waktu";

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

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{`${klien.nama}`}</h1>
            {!klien.bolehCatat && <Badge variant="outline">hanya baca</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {klien.kontak ?? "Tanpa kontak"} · Pemilik: {klien.pemilik.nama}
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
          <CardDescription>{klien.followup.length} kejadian.</CardDescription>
        </CardHeader>
        <CardContent>
          {klien.followup.length === 0 ? (
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
                {klien.followup.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap">{f.tanggal}</TableCell>
                    <TableCell>{f.hasil.nama}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.deskripsi ?? "Belum diisi"}
                      {f.edit.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                          {f.edit.map((e) => (
                            <li key={e.id}>
                              diubah {e.editor.nama}: {e.alasan}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>
                      {f.olehSupervisor
                        ? `${f.olehSupervisor.nama} (atas nama ${f.pencatat.nama})`
                        : f.pencatat.nama}
                    </TableCell>
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
