"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { kirimApi } from "@/lib/api-client";

type Nominal = { id: string; nama: string; nominal: number };
type Pilihan = { id: string; nama: string };

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function CatatIuran({
  karyawan,
  nominal,
  hariIni,
  bulanBerjalan,
  catatDari,
}: {
  karyawan: Pilihan[];
  nominal: Nominal[];
  hariIni: string;
  bulanBerjalan: string;
  catatDari?: string;
}) {
  const router = useRouter();
  const [awal] = useState(() => {
    const [idKaryawan, bulanDari] = (catatDari ?? "").split("|");
    return {
      karyawanId: idKaryawan || (karyawan[0]?.id ?? ""),
      bulan: bulanDari || bulanBerjalan,
    };
  });
  const [karyawanId, setKaryawanId] = useState(awal.karyawanId);
  const [bulan, setBulan] = useState(awal.bulan);
  const [pesanAwal, setPesanAwal] = useState<string | null>(null);
  const [nominalIuranId, setNominalIuranId] = useState("");
  const [tanggalBayar, setTanggalBayar] = useState(hariIni);
  const [busy, setBusy] = useState(false);

  const pemasalahan =
    pesanAwal ??
    (karyawanId === "" ? "Pilih karyawan." : bulan === "" ? "Pilih bulan." : null);
  const bisaKirim = pemasalahan === null && nominalIuranId !== "" && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!bisaKirim) return;
    setBusy(true);
    try {
      const hasil = await kirimApi("POST", "/api/pembayaran-iuran", {
        karyawanId,
        bulan,
        nominalIuranId,
        tanggalBayar,
      });
      if (!hasil.ok) {
        if (hasil.status === 409) setPesanAwal(`${hasil.message} Pilih bulan lain.`);
        toast.error(hasil.message);
        return;
      }
      setPesanAwal(null);
      const namaKaryawan = karyawan.find((k) => k.id === karyawanId)?.nama ?? "karyawan";
      toast.success(`Pembayaran ${namaKaryawan} untuk ${bulan.slice(0, 7)} dicatat.`);
      setNominalIuranId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (nominal.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Master Nominal Iuran belum diisi Admin, sehingga pembayaran belum bisa dicatat.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="iuranKaryawan">Untuk</Label>
        <Select value={karyawanId} onValueChange={setKaryawanId}>
          <SelectTrigger id="iuranKaryawan" className="w-full">
            <SelectValue placeholder="Pilih karyawan" />
          </SelectTrigger>
          <SelectContent>
            {karyawan.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="iuranBulan">Bulan</Label>
        <Input
          id="iuranBulan"
          type="month"
          value={bulan.slice(0, 7)}
          max={bulanBerjalan.slice(0, 7)}
          onChange={(e) => setBulan(e.target.value ? `${e.target.value}-01` : "")}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="iuranNominal">Nominal</Label>
        <Select value={nominalIuranId} onValueChange={setNominalIuranId}>
          <SelectTrigger id="iuranNominal" className="w-full">
            <SelectValue placeholder="Pilih nominal" />
          </SelectTrigger>
          <SelectContent>
            {nominal.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.nama} — {rupiah.format(n.nominal)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="iuranTanggal">Tanggal bayar</Label>
        <Input
          id="iuranTanggal"
          type="date"
          value={tanggalBayar}
          max={hariIni}
          onChange={(e) => setTanggalBayar(e.target.value)}
        />
      </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {pemasalahan && <p className="text-sm text-destructive">{pemasalahan}</p>}
        <Button type="submit" disabled={!bisaKirim}>
          {busy ? "Menyimpan…" : "Catat pembayaran"}
        </Button>
      </div>
    </form>
  );
}
