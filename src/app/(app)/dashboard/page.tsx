import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireKaryawan } from "@/lib/auth/current";
import { daftarLaporanSaya } from "@/lib/laporan/queries";
import { daftarAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { pekanWIB } from "@/lib/waktu";

function lencanaStatus(status: string, pekanBerjalan: boolean) {
  if (status === "Terkirim") return <Badge>Terkirim</Badge>;
  if (status === "Dikoreksi") return <Badge variant="outline">Dikoreksi</Badge>;
  return (
    <Badge variant={pekanBerjalan ? "secondary" : "destructive"}>
      {pekanBerjalan ? "Draf" : "Draf (pekan lewat)"}
    </Badge>
  );
}

async function IsiDashboard() {
  await connection();
  const { profil } = await requireKaryawan();
  const [laporan, anggota] = await Promise.all([
    daftarLaporanSaya(profil.id),
    daftarAnggotaLangsung(profil.id),
  ]);
  const pekan = pekanWIB();
  const laporanBerjalan = laporan.find((l) => l.pekanBerjalan) ?? null;

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Halo, {profil.nama}</h1>
          <p className="text-sm text-muted-foreground">
            Pekan berjalan: {pekan.mulai} s.d. {pekan.selesai} WIB
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
                      <TableCell>
                        {l.mulai} – {l.selesai}
                      </TableCell>
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
              {anggota.length === 0
                ? "Belum ada anggota yang Anda bimbing."
                : `${anggota.length} orang — datanya Anda isi di Laporan Pekan.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {anggota.map((a, i) => (
              <div key={a.id} className="flex flex-col gap-2">
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between gap-2">
                  <span>{`${a.nama}`}</span>
                  <Badge variant="outline">{a.level}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <IsiDashboard />
    </Suspense>
  );
}
