import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { FormKlienBaru } from "@/components/form-klien-baru";
import { BarisTabelSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { halamanKlienSaya } from "@/lib/klien/queries";
import { formatTanggal } from "@/lib/waktu";

const PER_HALAMAN = 25;

function tautanKlien(q: string, belum: boolean, hal: number): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (belum) p.set("belum", "1");
  if (hal > 1) p.set("hal", String(hal));
  const s = p.toString();
  return s ? `/klien?${s}` : "/klien";
}

async function IsiDaftar({ q, belum, hal }: { q: string; belum: boolean; hal: number }) {
  await connection();
  const { profil } = await requireKaryawanHalaman();
  const hasil = await halamanKlienSaya(profil.id, {
    q,
    belumFollowup: belum,
    halaman: hal,
    perHalaman: PER_HALAMAN,
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {q || belum ? `${hasil.total} klien cocok.` : `${hasil.total} klien.`}
      </p>

      {hasil.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q || belum
            ? "Tidak ada klien yang cocok. Coba kata lain atau hapus filter."
            : "Belum ada klien."}
        </p>
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
            {hasil.baris.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium whitespace-normal">{`${k.nama}`}</TableCell>
                <TableCell className="text-muted-foreground whitespace-normal">
                  {k.kontak ?? "Belum diisi"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{k.jumlahFollowup}</TableCell>
                <TableCell>
                  {k.followupTerakhir ? formatTanggal(k.followupTerakhir) : "Belum ada"}
                </TableCell>
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

      {hasil.totalHalaman > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Halaman {hasil.halaman} dari {hasil.totalHalaman}
          </p>
          <div className="flex gap-2">
            {hasil.halaman > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={tautanKlien(q, belum, hasil.halaman - 1)}>Sebelumnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="disabled:opacity-60">
                Sebelumnya
              </Button>
            )}
            {hasil.halaman < hasil.totalHalaman ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={tautanKlien(q, belum, hasil.halaman + 1)}>Berikutnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="disabled:opacity-60">
                Berikutnya
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function KlienPage({ searchParams }: PageProps<"/klien">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const belum = sp.belum === "1";
  const hal = Math.max(1, Number(sp.hal) || 1);

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

      <Card>
        <CardHeader>
          <CardTitle>Daftar klien</CardTitle>
          <CardDescription>
            Cari nama atau kontak, lalu buka untuk melihat follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            action="/klien"
            method="get"
            role="search"
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            {belum && <input type="hidden" name="belum" value="1" />}
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Cari nama atau kontak"
              aria-label="Cari nama atau kontak klien"
              className="focus-visible:ring-3 focus-visible:ring-ring sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="outline" className="active:translate-y-px">
                Cari
              </Button>
              <Button variant={belum ? "secondary" : "outline"} asChild>
                <Link href={tautanKlien(q, !belum, 1)}>
                  {belum ? "Semua klien" : "Belum ada follow-up"}
                </Link>
              </Button>
              {(q || belum) && (
                <Button variant="ghost" asChild>
                  <Link href="/klien">Hapus filter</Link>
                </Button>
              )}
            </div>
          </form>

          <Suspense fallback={<BarisTabelSkeleton jumlahBaris={8} />}>
            <IsiDaftar q={q} belum={belum} hal={hal} />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
