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
} from "@/components/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { daftarNominalIuran, daftarPembayaran, rekapIuranBanyak } from "@/lib/iuran/queries";
import { daftarAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { bulanBerjalan, formatTanggal, tanggalHariIni } from "@/lib/waktu";

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

const BULAN_PENDEK = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
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

      <Card>
        <CardHeader>
          <CardTitle>Ledger iuran</CardTitle>
          <CardDescription>
            {`${labelBulan(kolom[0]?.bulan ?? berjalan)} sampai ${labelBulan(berjalan)}. ${lunasBulanIni} dari ${rekap.length} karyawan sudah membayar ${labelBulan(berjalan)}.`}
          </CardDescription>
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
                    const [tahun, bulanKe] = b.bulan.split("-").map(Number);
                    return (
                      <th
                        key={b.bulan}
                        scope="col"
                        className={cn(
                          "sticky top-0 z-20 border-b bg-card px-1 py-2 text-center align-bottom font-normal whitespace-nowrap",
                          b.bulan === berjalan && "bg-secondary",
                        )}
                      >
                        <span className="block text-xs">{BULAN_PENDEK[bulanKe! - 1]}</span>
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
                          b.bulan === berjalan && !b.lunas && "bg-secondary/50",
                        )}
                      >
                        {b.lunas ? (
                          <span
                            data-slot="ledger-cell"
                            className="mx-auto flex size-8 items-center justify-center rounded-md bg-secondary text-foreground"
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
      <IsiIuran searchParams={searchParams} />
    </Suspense>
  );
}
