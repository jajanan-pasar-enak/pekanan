import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  BarisTabelSkeleton,
  HalamanSkeleton,
  KartuSkeleton,
  Skeleton,
} from "@/components/skeleton";
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
import { requireKaryawan } from "@/lib/auth/current";
import { AppError } from "@/lib/http";
import { getRekapPekan } from "@/lib/kepegawaian/queries";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function angka(n: number | null): string {
  return n === null ? "—" : String(n);
}

async function IsiRekapPekan({ pekanId }: { pekanId: string }) {
  await connection();
  if (!POLA_UUID.test(pekanId)) notFound();
  const { sesi, profil } = await requireKaryawan();
  let rekap;
  try {
    rekap = await getRekapPekan(pekanId, {
      karyawanId: profil.id,
      admin: sesi.user.role === "admin",
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const { pekan, baris, total } = rekap;
  const ringkasan = [
    { label: "Anggota", nilai: String(total.anggota) },
    { label: "Baris lengkap", nilai: `${total.lengkap}/${total.anggota}` },
    { label: "Media online", nilai: String(total.mediaOnline) },
    { label: "Media offline", nilai: String(total.mediaOffline) },
    { label: "Follow-up", nilai: String(total.followup) },
  ];

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Rekap Pekan</h1>
          <p className="text-sm text-muted-foreground">
            {pekan.mulai} s.d. {pekan.selesai} WIB
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/rekap">Kembali</Link>
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ringkasan.map((r) => (
          <Card key={r.label}>
            <CardHeader>
              <CardDescription>{r.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{r.nilai}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rincian Anggota</CardTitle>
          <CardDescription>
            Follow-up dihitung dari kejadian bertanggal di pekan ini, bukan angka manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {baris.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada laporan Anggota Langsung pada pekan ini.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Kehadiran</TableHead>
                  <TableHead className="text-right">Media online</TableHead>
                  <TableHead className="text-right">Media offline</TableHead>
                  <TableHead>One-on-one</TableHead>
                  <TableHead className="text-right">Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((b) => (
                  <TableRow key={b.anggotaId}>
                    <TableCell className="font-medium">{b.nama}</TableCell>
                    <TableCell>{b.kehadiran ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {angka(b.mediaOnline)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {angka(b.mediaOffline)}
                    </TableCell>
                    <TableCell>{b.oneOnOne ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.followup}</TableCell>
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

export default async function RekapPekanPage({ params }: PageProps<"/rekap/[pekanId]">) {
  const { pekanId } = await params;
  return (
    <Suspense
      fallback={
        <HalamanSkeleton
          judul="Rekap Pekan"
          aksi={
            <Button variant="outline" asChild>
              <Link href="/rekap">Kembali</Link>
            </Button>
          }
          anak={
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
              <KartuSkeleton
                judul="Rincian Anggota"
                anak={<BarisTabelSkeleton jumlahBaris={5} />}
              />
            </>
          }
        />
      }
    >
      <IsiRekapPekan pekanId={pekanId} />
    </Suspense>
  );
}
