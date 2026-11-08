import { Suspense } from "react";
import { connection } from "next/server";
import { CatatIuran } from "@/components/catat-iuran";
import {
  BarisTabelSkeleton,
  HalamanSkeleton,
  IsiKartuSkeleton,
  KartuSkeleton,
  KartuTabelSkeleton,
} from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { daftarNominalIuran, daftarPembayaran, rekapIuranKaryawan } from "@/lib/iuran/queries";
import { daftarAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { bulanBerjalan, tanggalHariIni } from "@/lib/waktu";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function labelBulan(iso: string): string {
  const [tahun, bulan] = iso.split("-").map(Number);
  return `${BULAN[bulan! - 1]} ${tahun}`;
}

// Daftar bulan berjalan dan 11 bulan sebelumnya (terbaru di atas).
function duaBelasBulan(berjalan: string): string[] {
  let [tahun, bulan] = berjalan.split("-").map(Number);
  const hasil: string[] = [];
  for (let i = 0; i < 12; i++) {
    hasil.push(`${tahun}-${String(bulan).padStart(2, "0")}-01`);
    bulan! -= 1;
    if (bulan! < 1) {
      bulan = 12;
      tahun! -= 1;
    }
  }
  return hasil;
}

async function IsiIuran({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { profil } = await requireKaryawan();
  const berjalan = bulanBerjalan();
  const bulan = duaBelasBulan(berjalan);
  const dariBulan = bulan[bulan.length - 1]!;

  const [anggota, nominal, pembayaran] = await Promise.all([
    daftarAnggotaLangsung(profil.id),
    daftarNominalIuran(true),
    daftarPembayaran(profil.id),
  ]);
  const orang = [
    { id: profil.id, nama: `${profil.nama} (saya)` },
    ...anggota.map((a) => ({ id: a.id, nama: a.nama })),
  ];
  const rekap = await Promise.all(
    orang.map(async (o) => ({
      ...o,
      bulan: await rekapIuranKaryawan(o.id, dariBulan, berjalan),
    })),
  );
  const bisaCatat = new Set(orang.map((o) => o.id));
  const parameter = await searchParams;
  const catatDari =
    typeof parameter.catat === "string" && bisaCatat.has(parameter.catat.split("|")[0] ?? "")
      ? parameter.catat
      : undefined;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Iuran</h1>
        <p className="text-sm text-muted-foreground">
          Master Nominal Iuran diatur Admin. Satu pembayaran per karyawan per bulan.
        </p>
      </header>

      <Card id="catat-iuran" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Catat pembayaran</CardTitle>
          <CardDescription>
            Hanya untuk diri sendiri dan Anggota Langsung. Bulan mendatang tidak bisa dicatat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CatatIuran
            karyawan={orang}
            nominal={nominal}
            hariIni={tanggalHariIni()}
            bulanBerjalan={berjalan}
            catatDari={catatDari}
          />
        </CardContent>
      </Card>

      {rekap.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle>{`${r.nama}`}</CardTitle>
            <CardDescription>
              {r.bulan.filter((b) => b.lunas).length}/{r.bulan.length} bulan lunas (12 bulan
              terakhir).
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bulan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.bulan.map((b) => (
                  <TableRow key={b.bulan}>
                    <TableCell>{labelBulan(b.bulan)}</TableCell>
                    <TableCell>
                      {b.lunas ? (
                        <Badge>Tercatat</Badge>
                      ) : b.bulan === berjalan ? (
                        <Badge variant="secondary">Belum — bulan berjalan</Badge>
                      ) : (
                        <Badge variant="outline">Belum</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.nominal === null ? "—" : rupiah.format(b.nominal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {!b.lunas && b.bulan <= berjalan && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/iuran?catat=${r.id}|${b.bulan}#catat-iuran`}>Catat</a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat pembayaran</CardTitle>
          <CardDescription>
            Dari Anda dan Anggota Langsung Anda ({pembayaran.length} baris).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {pembayaran.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Bulan</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Tanggal bayar</TableHead>
                  <TableHead>Dicatat oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pembayaran.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{`${p.karyawan.nama}`}</TableCell>
                    <TableCell>{labelBulan(p.bulan)}</TableCell>
                    <TableCell>{p.nominal.nama}</TableCell>
                    <TableCell>{p.tanggalBayar}</TableCell>
                    <TableCell>
                      {`${p.pencatat.nama}`}
                      {p.olehSupervisor && (
                        <span className="ml-2 text-xs text-muted-foreground">(supervisor)</span>
                      )}
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

export default async function IuranPage({ searchParams }: PageProps<"/iuran">) {
  const parameter = await searchParams;
  return (
    <Suspense
      fallback={
        <HalamanSkeleton
          judul="Iuran"
          subjudul="Master Nominal Iuran diatur Admin. Satu pembayaran per karyawan per bulan."
          anak={
            <>
              <KartuSkeleton judul="Catat pembayaran" anak={<IsiKartuSkeleton />} />
              <KartuTabelSkeleton />
              <KartuSkeleton judul="Riwayat pembayaran" anak={<BarisTabelSkeleton />} />
            </>
          }
        />
      }
    >
      <IsiIuran searchParams={Promise.resolve(parameter)} />
    </Suspense>
  );
}
