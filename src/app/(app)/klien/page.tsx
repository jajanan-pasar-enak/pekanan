import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { FormKlienBaru } from "@/components/form-klien-baru";
import { BarisTabelSkeleton, KartuSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireKaryawan } from "@/lib/auth/current";
import { daftarKlienSaya } from "@/lib/klien/queries";

async function DaftarKlien() {
  await connection();
  const { profil } = await requireKaryawan();
  const klien = await daftarKlienSaya(profil.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar klien</CardTitle>
        <CardDescription>{klien.length} klien.</CardDescription>
      </CardHeader>
      <CardContent>
        {klien.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada klien.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead className="text-right">Follow-up</TableHead>
                <TableHead>Terakhir</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {klien.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{`${k.nama}`}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {k.kontak ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {k.jumlahFollowup}
                  </TableCell>
                  <TableCell>{k.followupTerakhir ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/klien/${k.id}`}>Buka</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Header dan form tambah klien tidak bergantung data, jadi langsung tampil;
// hanya daftar klien yang menunggu.
export default function KlienPage() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Klien Saya</h1>
        <p className="text-sm text-muted-foreground">
          Follow-up dicatat dari kejadian; jumlah per pekan dihitung otomatis.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tambah klien</CardTitle>
          <CardDescription>Klien langsung menjadi milik Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormKlienBaru />
        </CardContent>
      </Card>

      <Suspense fallback={<KartuSkeleton judul="Daftar klien" anak={<BarisTabelSkeleton />} />}>
        <DaftarKlien />
      </Suspense>
    </>
  );
}
