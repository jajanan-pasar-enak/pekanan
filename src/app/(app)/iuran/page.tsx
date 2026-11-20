import { Suspense } from "react";
import { connection } from "next/server";
import { CheckIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { CatatIuran } from "@/components/catat-iuran";
import {
  BarisTabelSkeleton,
  HalamanSkeleton,
  IsiKartuSkeleton,
  KartuSkeleton,
  KartuTabelSkeleton,
  Skeleton,
} from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { duaBelasBulan, labelBulan, labelBulanPendek } from "@/lib/iuran/label";
import { daftarNominalIuran, daftarPembayaran, rekapIuranBanyak } from "@/lib/iuran/queries";
import { daftarAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { bulanBerjalan, formatTanggal, tanggalHariIni } from "@/lib/waktu";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

async function IsiIuran({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { profil } = await requireKaryawanHalaman();
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
  const rekapPeta = await rekapIuranBanyak(
    orang.map((o) => o.id),
    dariBulan,
    berjalan,
  );
  const rekap = orang.map((o) => ({ ...o, bulan: rekapPeta.get(o.id) ?? [] }));
  const kolom = rekap[0]?.bulan ?? [];
  const lunasBulanIni = rekap.filter(
    (r) => r.bulan.find((b) => b.bulan === berjalan)?.lunas,
  ).length;
  const belumBulanIni = rekap.filter((r) => !r.bulan.find((b) => b.bulan === berjalan)?.lunas);
  const persenLunas = rekap.length > 0 ? Math.round((lunasBulanIni / rekap.length) * 100) : 0;
  const namaBelum = belumBulanIni.map((r) => r.nama);
  const namaBelumTampil = namaBelum.slice(0, 6);
  const namaBelumSisa = namaBelum.length - namaBelumTampil.length;
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
          Pantau iuran bulanan diri sendiri dan Anggota Langsung.
        </p>
      </header>

      <section
        aria-labelledby="bulan-berjalan"
        className="rounded-xl bg-card ring-1 ring-foreground/10"
      >
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm text-muted-foreground">Bulan berjalan</p>
            <h2 id="bulan-berjalan" className="text-3xl font-semibold tracking-tight">
              {labelBulan(berjalan)}
            </h2>
            <div className="flex max-w-md flex-col gap-2">
              <p className="flex items-baseline gap-2">
                <span className="text-2xl leading-none font-semibold tabular-nums">
                  {lunasBulanIni}/{rekap.length}
                </span>
                <span className="text-sm text-muted-foreground">sudah membayar</span>
              </p>
              <div
                role="progressbar"
                aria-label={`Pembayaran iuran ${labelBulan(berjalan)}`}
                aria-valuemin={0}
                aria-valuemax={rekap.length}
                aria-valuenow={lunasBulanIni}
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-signal"
                  style={{ width: `${persenLunas}%` }}
                />
              </div>
            </div>
            {belumBulanIni.length === 0 ? (
              <p className="text-sm font-medium text-signal">Semua sudah membayar bulan ini.</p>
            ) : (
              <p className="max-w-md text-sm text-muted-foreground">
                Belum membayar: {namaBelumTampil.join(", ")}
                {namaBelumSisa > 0 && `, dan ${namaBelumSisa} lainnya`}.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Button asChild size="lg">
              <a href="#catat-iuran">Catat pembayaran</a>
            </Button>
            <p className="text-xs text-muted-foreground">Satu pembayaran per karyawan per bulan.</p>
          </div>
        </div>
      </section>

      <Card id="catat-iuran" className="scroll-mt-28 md:scroll-mt-20">
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

      <Card>
        <CardHeader>
          <CardTitle>Ledger iuran</CardTitle>
          <CardDescription>
            Dua belas bulan terakhir. Kolom pertama adalah bulan berjalan.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/iuran/ledger">Ekspor CSV</a>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Centang berarti tercatat. Tombol + mencatat pembayaran untuk bulan itu.
          </p>
          <div className="max-h-[70vh] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 left-0 z-30 min-w-40 border-b bg-card px-2 py-2 text-left font-medium"
                  >
                    Karyawan
                  </th>
                  {kolom.map((b) => {
                    const [singkat, tahun] = labelBulanPendek(b.bulan).split(" ");
                    return (
                      <th
                        key={b.bulan}
                        scope="col"
                        className={cn(
                          "sticky top-0 z-20 border-b bg-card px-1 py-2 text-center align-bottom font-normal whitespace-nowrap",
                          b.bulan === berjalan &&
                            "border-b-2 border-b-signal font-medium text-signal",
                        )}
                      >
                        <span className="block text-xs">{singkat}</span>
                        <span className="block text-[11px] text-muted-foreground">{tahun}</span>
                      </th>
                    );
                  })}
                  <th
                    scope="col"
                    className="sticky top-0 z-20 border-b bg-card px-2 py-2 text-right font-medium whitespace-nowrap"
                  >
                    Lunas
                  </th>
                </tr>
              </thead>
              <tbody>
                {rekap.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 min-w-40 border-r bg-card px-2 py-1.5 text-left font-medium"
                    >
                      {r.nama}
                    </th>
                    {r.bulan.map((b) => (
                      <td
                        key={b.bulan}
                        className={cn(
                          "px-1 py-1 text-center",
                          b.bulan === berjalan && !b.lunas && "bg-signal/5",
                        )}
                      >
                        {b.lunas ? (
                          <span
                            data-slot="ledger-cell"
                            className="mx-auto flex size-8 items-center justify-center rounded-md bg-signal/10 text-signal"
                            title={`Tercatat, ${rupiah.format(b.nominal ?? 0)}`}
                          >
                            <CheckIcon className="size-3.5" aria-hidden />
                            <span className="sr-only">{`Tercatat ${labelBulan(b.bulan)}`}</span>
                          </span>
                        ) : (
                          <a
                            href={`/iuran?catat=${r.id}|${b.bulan}#catat-iuran`}
                            data-slot="ledger-cell"
                            className="mx-auto flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none active:translate-y-px"
                            aria-label={`Catat iuran ${r.nama} untuk ${labelBulan(b.bulan)}`}
                          >
                            <PlusIcon className="size-3.5" aria-hidden />
                          </a>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.bulan.filter((b) => b.lunas).length}/{r.bulan.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                    <TableCell>{formatTanggal(p.tanggalBayar)}</TableCell>
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

export default function IuranPage({ searchParams }: PageProps<"/iuran">) {
  return (
    <Suspense
      fallback={
        <HalamanSkeleton
          judul="Iuran"
          subjudul="Pantau iuran bulanan diri sendiri dan Anggota Langsung."
          anak={
            <>
              <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10" aria-hidden>
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-56 max-w-full" />
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-1.5 w-full max-w-md rounded-full" />
                </div>
              </div>
              <KartuSkeleton judul="Catat pembayaran" anak={<IsiKartuSkeleton />} />
              <KartuTabelSkeleton />
              <KartuSkeleton judul="Riwayat pembayaran" anak={<BarisTabelSkeleton />} />
            </>
          }
        />
      }
    >
      <IsiIuran searchParams={searchParams} />
    </Suspense>
  );
}
