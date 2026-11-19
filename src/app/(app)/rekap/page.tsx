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
import {
  BarisTabelSkeleton,
  HalamanSkeleton,
  KartuSkeleton,
  Skeleton,
} from "@/components/skeleton";
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { daftarRekapAnggota } from "@/lib/kepegawaian/queries";
import { formatRentangTanggal } from "@/lib/waktu";

function lencanaStatus(status: string) {
  if (status === "Terkirim") {
    return (
      <Badge className="border-signal/25 bg-signal/10 text-signal font-medium" variant="outline">
        Terkirim
      </Badge>
    );
  }
  if (status === "Dikoreksi") return <Badge variant="outline">Dikoreksi</Badge>;
  return <Badge variant="secondary">Draf</Badge>;
}

async function IsiRekap() {
  await connection();
  const { profil } = await requireKaryawanHalaman();
  const daftar = await daftarRekapAnggota(profil.id);

  const kelompok: {
    pekanId: string;
    mulai: string;
    selesai: string;
    baris: typeof daftar;
  }[] = [];
  for (const r of daftar) {
    const terakhir = kelompok[kelompok.length - 1];
    if (terakhir && terakhir.pekanId === r.pekanId) {
      terakhir.baris.push(r);
    } else {
      kelompok.push({ pekanId: r.pekanId, mulai: r.mulai, selesai: r.selesai, baris: [r] });
    }
  }

  const pekanTerbaru = kelompok[0] ?? null;
  const selesai = pekanTerbaru ? pekanTerbaru.baris.filter((r) => r.status !== "Draf").length : 0;
  const menunggu = pekanTerbaru
    ? pekanTerbaru.baris.filter((r) => r.status === "Draf").map((r) => r.supervisor)
    : [];
  const persenSelesai =
    pekanTerbaru && pekanTerbaru.baris.length > 0
      ? Math.round((selesai / pekanTerbaru.baris.length) * 100)
      : 0;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rekap Pekan</h1>
        <p className="text-sm text-muted-foreground">
          Laporan pekan dari Anggota Langsung Anda, beserta jumlah follow-up tiap anggota.
        </p>
      </header>

      {pekanTerbaru && (
        <section
          aria-labelledby="pekan-terbaru"
          className="rounded-xl bg-card ring-1 ring-foreground/10"
        >
          <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-sm text-muted-foreground">Pekan terbaru</p>
              <h2 id="pekan-terbaru" className="text-3xl font-semibold tracking-tight">
                {formatRentangTanggal(pekanTerbaru.mulai, pekanTerbaru.selesai)}
              </h2>
              <div className="flex max-w-md flex-col gap-2">
                <p className="flex items-baseline gap-2">
                  <span className="text-2xl leading-none font-semibold tabular-nums">
                    {selesai}/{pekanTerbaru.baris.length}
                  </span>
                  <span className="text-sm text-muted-foreground">laporan sudah dikirim</span>
                </p>
                <div
                  role="progressbar"
                  aria-label="Laporan yang sudah dikirim pada pekan terbaru"
                  aria-valuemin={0}
                  aria-valuemax={pekanTerbaru.baris.length}
                  aria-valuenow={selesai}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-signal"
                    style={{ width: `${persenSelesai}%` }}
                  />
                </div>
              </div>
              {menunggu.length === 0 ? (
                <p className="text-sm font-medium text-signal">
                  Semua laporan pekan ini sudah dikirim.
                </p>
              ) : (
                <p className="max-w-md text-sm text-muted-foreground">
                  Menunggu: {menunggu.join(", ")}.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <Button asChild size="lg">
                <Link href={`/rekap/${pekanTerbaru.pekanId}`}>Lihat rekap pekan</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Follow-up dihitung dari kejadian bertanggal.
              </p>
            </div>
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Laporan Anggota</CardTitle>
          <CardDescription>
            {daftar.length === 0
              ? "Belum ada laporan. Daftar terisi setelah Anggota Langsung Anda punya laporan pekan."
              : `${daftar.length} laporan dalam ${kelompok.length} pekan, terbaru di atas.`}
          </CardDescription>
        </CardHeader>
        {daftar.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Terisi</TableHead>
                </TableRow>
              </TableHeader>
              {kelompok.map((k) => (
                <TableBody key={k.pekanId}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={3} className="py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {formatRentangTanggal(k.mulai, k.selesai)}
                        </span>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/rekap/${k.pekanId}`}>Lihat rekap</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {k.baris.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.supervisor}</TableCell>
                      <TableCell>{lencanaStatus(r.status)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {`${r.diisi}/${r.total}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              ))}
            </Table>
          </CardContent>
        )}
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
            <>
              <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10" aria-hidden>
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-56 max-w-full" />
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-1.5 w-full max-w-md rounded-full" />
                </div>
              </div>
              <KartuSkeleton
                judul="Daftar Laporan Anggota"
                anak={<BarisTabelSkeleton jumlahBaris={6} />}
              />
            </>
          }
        />
      }
    >
      <IsiRekap />
    </Suspense>
  );
}
