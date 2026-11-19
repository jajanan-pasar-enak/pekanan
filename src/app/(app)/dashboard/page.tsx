import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  BarisTabelSkeleton,
  HalamanSkeleton,
  KartuAnggotaSkeleton,
  KartuSkeleton,
} from "@/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { daftarLaporanSaya } from "@/lib/laporan/queries";
import { halamanAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { formatRentangTanggal, pekanWIB } from "@/lib/waktu";

const ANGGOTA_PER_HALAMAN = 10;

function tautanAnggota(q: string, hal: number): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (hal > 1) p.set("hal", String(hal));
  const s = p.toString();
  return s ? `/dashboard?${s}` : "/dashboard";
}

function lencanaStatus(status: string, pekanBerjalan: boolean) {
  if (status === "Terkirim") return <Badge>Terkirim</Badge>;
  if (status === "Dikoreksi") return <Badge variant="outline">Dikoreksi</Badge>;
  return (
    <Badge variant={pekanBerjalan ? "secondary" : "destructive"}>
      {pekanBerjalan ? "Draf" : "Draf (pekan lewat)"}
    </Badge>
  );
}

async function IsiDashboard({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const hal = Math.max(1, Number(sp.hal) || 1);
  const { profil } = await requireKaryawanHalaman();
  const [laporan, anggota] = await Promise.all([
    daftarLaporanSaya(profil.id),
    halamanAnggotaLangsung(profil.id, {
      q,
      halaman: hal,
      perHalaman: ANGGOTA_PER_HALAMAN,
    }),
  ]);
  const pekan = pekanWIB();
  const laporanBerjalan = laporan.find((l) => l.pekanBerjalan) ?? null;

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Halo, {profil.nama}</h1>
          <p className="text-sm text-muted-foreground">
            Pekan berjalan: {formatRentangTanggal(pekan.mulai, pekan.selesai)} WIB
          </p>
        </div>
        {laporanBerjalan && (
          <Button asChild>
            <Link href={`/laporan/${laporanBerjalan.id}`}>
              {laporanBerjalan.status === "Draf" ? "Isi Laporan Pekan" : "Lihat Laporan Pekan"}
            </Link>
          </Button>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Laporan Pekan Saya</CardTitle>
            <CardDescription>
              Dibuat otomatis setiap pekan selama Anda punya Anggota Langsung.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {laporan.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada laporan. Laporan Draf dibuat bila Anda punya Anggota Langsung.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pekan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Terisi</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laporan.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{formatRentangTanggal(l.mulai, l.selesai)}</TableCell>
                      <TableCell>{lencanaStatus(l.status, l.pekanBerjalan)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {`${l.diisi}/${l.total}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/laporan/${l.id}`}>Buka</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Anggota Langsung</CardTitle>
            <CardDescription>
              {anggota.total === 0
                ? q
                  ? "Tidak ada anggota yang cocok."
                  : "Belum ada anggota yang Anda bimbing."
                : q
                  ? `${anggota.total} anggota cocok.`
                  : `${anggota.total} orang. Datanya Anda isi di Laporan Pekan.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form
              action="/dashboard"
              method="get"
              role="search"
              className="flex flex-wrap items-center gap-2"
            >
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Cari nama anggota"
                aria-label="Cari nama anggota langsung"
                className="focus-visible:ring-3 focus-visible:ring-ring min-w-0 flex-1"
              />
              <Button type="submit" variant="outline" className="active:translate-y-px">
                Cari
              </Button>
              {q && (
                <Button variant="ghost" asChild>
                  <Link href="/dashboard">Hapus</Link>
                </Button>
              )}
            </form>

            {anggota.total === 0
              ? q && (
                  <p className="text-sm text-muted-foreground">
                    Coba kata lain atau hapus pencarian.
                  </p>
                )
              : anggota.baris.map((a, i) => (
                  <div key={a.id} className="flex flex-col gap-2">
                    {i > 0 && <Separator />}
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate" title={a.nama}>
                        {a.nama}
                      </span>
                      <Badge variant="outline">{a.level}</Badge>
                    </div>
                  </div>
                ))}

            {anggota.totalHalaman > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground tabular-nums">
                  Halaman {anggota.halaman} dari {anggota.totalHalaman}
                </p>
                <div className="flex gap-2">
                  {anggota.halaman > 1 ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={tautanAnggota(q, anggota.halaman - 1)}>Sebelumnya</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled className="disabled:opacity-60">
                      Sebelumnya
                    </Button>
                  )}
                  {anggota.halaman < anggota.totalHalaman ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={tautanAnggota(q, anggota.halaman + 1)}>Berikutnya</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled className="disabled:opacity-60">
                      Berikutnya
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <HalamanSkeleton
      anak={
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <KartuSkeleton
              judul="Laporan Pekan Saya"
              className="lg:col-span-3"
              anak={<BarisTabelSkeleton jumlahBaris={2} />}
            />
            <KartuSkeleton
              judul="Anggota Langsung"
              className="lg:col-span-2"
              anak={<KartuAnggotaSkeleton jumlahBaris={5} />}
            />
          </div>
        </div>
      }
    />
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <IsiDashboard searchParams={searchParams} />
    </Suspense>
  );
}
