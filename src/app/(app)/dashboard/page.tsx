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
  KartuAnggotaSkeleton,
  KartuSkeleton,
  Skeleton,
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
import { daftarLaporanSaya, statusLengkapAnggota } from "@/lib/laporan/queries";
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
  if (status === "Terkirim") {
    return (
      <Badge className="border-signal/25 bg-signal/10 text-signal font-medium" variant="outline">
        Terkirim
      </Badge>
    );
  }
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
  const statusPekan = laporanBerjalan ? await statusLengkapAnggota(laporanBerjalan.id) : null;
  const riwayat = laporan.filter((l) => !l.pekanBerjalan);
  const persen =
    laporanBerjalan && laporanBerjalan.total > 0
      ? Math.round((laporanBerjalan.diisi / laporanBerjalan.total) * 100)
      : 0;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {profil.nama}</h1>
      </header>

      <section
        aria-labelledby="pekan-berjalan"
        className="rounded-xl bg-card ring-1 ring-foreground/10"
      >
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm text-muted-foreground">Pekan berjalan</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="pekan-berjalan"
                className="font-display text-3xl font-semibold tracking-tight text-balance"
              >
                {formatRentangTanggal(pekan.mulai, pekan.selesai)}
              </h2>
              {laporanBerjalan && lencanaStatus(laporanBerjalan.status, true)}
            </div>

            {laporanBerjalan ? (
              <div className="flex max-w-md flex-col gap-2">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-[1.6rem] leading-none font-semibold tabular-nums">
                    {laporanBerjalan.diisi}/{laporanBerjalan.total}
                  </span>
                  <span className="text-sm text-muted-foreground">anggota terisi</span>
                </p>
                <div
                  role="progressbar"
                  aria-label="Anggota yang sudah terisi pada pekan berjalan"
                  aria-valuemin={0}
                  aria-valuemax={laporanBerjalan.total}
                  aria-valuenow={laporanBerjalan.diisi}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-signal" style={{ width: `${persen}%` }} />
                </div>
              </div>
            ) : (
              <p className="max-w-md text-sm text-muted-foreground">
                Belum ada laporan untuk pekan ini. Laporan Draf dibuat otomatis bila Anda punya
                Anggota Langsung.
              </p>
            )}
          </div>

          {laporanBerjalan && (
            <div className="flex flex-col gap-2 md:items-end">
              <Button asChild size="lg">
                <Link href={`/laporan/${laporanBerjalan.id}`}>
                  {laporanBerjalan.status === "Draf" ? "Isi laporan pekan" : "Lihat laporan pekan"}
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                {laporanBerjalan.status === "Draf"
                  ? "Lengkapi kehadiran, follow-up, dan one-on-one."
                  : "Periksa kembali isi laporan pekan ini."}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Riwayat pekan</CardTitle>
            <CardDescription>
              {riwayat.length === 0
                ? "Belum ada pekan sebelumnya."
                : `${riwayat.length} pekan sebelumnya, terbaru di atas.`}
            </CardDescription>
          </CardHeader>
          {riwayat.length > 0 && (
            <CardContent>
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
                  {riwayat.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{formatRentangTanggal(l.mulai, l.selesai)}</TableCell>
                      <TableCell>{lencanaStatus(l.status, false)}</TableCell>
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
            </CardContent>
          )}
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
                  : statusPekan
                    ? `${anggota.total} orang. Status pengisian pekan ini di samping nama.`
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
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline">{a.level}</Badge>
                        {statusPekan && (
                          <span className="text-xs" title="Status pengisian pekan ini">
                            <span className="sr-only">Pekan ini: </span>
                            {statusPekan.get(a.id) === true ? (
                              <span className="font-medium text-signal">Lengkap</span>
                            ) : statusPekan.has(a.id) ? (
                              <span className="text-muted-foreground">Belum diisi</span>
                            ) : (
                              <span className="text-muted-foreground">Tidak di laporan</span>
                            )}
                          </span>
                        )}
                      </span>
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
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>
      <header>
        <Skeleton className="h-8 w-56" />
      </header>
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-1.5 w-full max-w-md rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <KartuSkeleton
          judul="Riwayat pekan"
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
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <IsiDashboard searchParams={searchParams} />
    </Suspense>
  );
}
