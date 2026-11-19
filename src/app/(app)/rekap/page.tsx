import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
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
import { BarisTabelSkeleton, HalamanSkeleton, KartuSkeleton } from "@/components/skeleton";
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { daftarRekapAnggota } from "@/lib/kepegawaian/queries";

async function IsiRekap() {
  await connection();
  const { profil } = await requireKaryawanHalaman();
  const daftar = await daftarRekapAnggota(profil.id);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rekap Pekan</h1>
        <p className="text-sm text-muted-foreground">
          Laporan pekan dari Anggota Langsung Anda, beserta jumlah follow-up tiap anggota.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Laporan Anggota</CardTitle>
          <CardDescription>
            {daftar.length === 0
              ? "Belum ada laporan. Daftar terisi setelah Anggota Langsung Anda punya laporan pekan."
              : `${daftar.length} laporan, terbaru di atas.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {daftar.length === 0 ? null : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Pekan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Terisi</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.supervisor}</TableCell>
                    <TableCell>
                      {r.mulai} s.d. {r.selesai}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Draf" ? "secondary" : "outline"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {`${r.diisi}/${r.total}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/rekap/${r.pekanId}`}>Lihat rekap</Link>
                      </Button>
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

export default function RekapPage() {
  return (
    <Suspense
      fallback={
        <HalamanSkeleton
          judul="Rekap Pekan"
          subjudul="Laporan pekan dari Anggota Langsung Anda, beserta jumlah follow-up tiap anggota."
          anak={
            <KartuSkeleton
              judul="Daftar Laporan Anggota"
              anak={<BarisTabelSkeleton jumlahBaris={6} />}
            />
          }
        />
      }
    >
      <IsiRekap />
    </Suspense>
  );
}
