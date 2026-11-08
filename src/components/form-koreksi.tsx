"use client";

import { useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { kirimApi } from "@/lib/api-client";
import { CARA_ONE_ON_ONE, STATUS_KEHADIRAN, type BarisNilai } from "@/lib/laporan/aturan";
import type { BarisLaporan } from "@/lib/laporan/queries";

type BarisKoreksi = BarisLaporan & {
  mediaOnlineTeks: string;
  mediaOfflineTeks: string;
};

function keBaris(b: BarisLaporan): BarisKoreksi {
  return {
    ...b,
    mediaOnlineTeks: b.mediaOnline === null ? "" : String(b.mediaOnline),
    mediaOfflineTeks: b.mediaOffline === null ? "" : String(b.mediaOffline),
  };
}

function angkaDari(teks: string): number | null {
  if (teks.trim() === "") return null;
  const n = Number(teks);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function nilai(b: BarisKoreksi): BarisNilai {
  return {
    kehadiran: b.kehadiran,
    keteranganHadir: b.keteranganHadir,
    mediaOnline: b.mediaOnline,
    mediaOffline: b.mediaOffline,
    oneOnOne: b.oneOnOne,
    keteranganOneOnOne: b.keteranganOneOnOne,
  };
}

export function FormKoreksi({
  laporanId,
  barisAwal,
}: {
  laporanId: string;
  barisAwal: BarisLaporan[];
}) {
  const router = useRouter();
  const awal = useMemo(() => barisAwal.map(keBaris), [barisAwal]);
  const [baris, setBaris] = useState<BarisKoreksi[]>(awal);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);

  const berubah = baris.filter(
    (b, i) => JSON.stringify(nilai(b)) !== JSON.stringify(nilai(awal[i]!)),
  );
  const bisaKirim = alasan.trim() !== "" && berubah.length > 0 && !busy;

  function ubah(anggotaId: string, patch: Partial<BarisKoreksi>) {
    setBaris((lama) => lama.map((b) => (b.anggotaId === anggotaId ? { ...b, ...patch } : b)));
  }

  async function kirim() {
    setBusy(true);
    try {
      const hasil = await kirimApi("POST", `/api/laporan/${laporanId}/koreksi`, {
        alasan: alasan.trim(),
        baris: berubah.map((b) => ({ anggotaId: b.anggotaId, ...nilai(b) })),
      });
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success("Koreksi tersimpan.");
      router.push(`/laporan/${laporanId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="alasan">Alasan koreksi (wajib)</Label>
        <Textarea
          id="alasan"
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          rows={3}
          placeholder="Contoh: kehadiran Bima pada Rabu seharusnya Sakit, bukan Tanpa Keterangan."
        />
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anggota</TableHead>
              <TableHead>Kehadiran</TableHead>
              <TableHead>Keterangan kehadiran</TableHead>
              <TableHead className="w-28">Media online</TableHead>
              <TableHead className="w-28">Media offline</TableHead>
              <TableHead>One-on-one</TableHead>
              <TableHead>Keterangan O2O</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {baris.map((b, i) => {
              const diubah = berubah.includes(b);
              return (
                <TableRow key={b.anggotaId} className={diubah ? "bg-amber-500/5" : undefined}>
                  <TableCell className="font-medium">
                    {`${b.nama}`}
                    {diubah && (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                        diubah
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={b.kehadiran ?? ""}
                      onValueChange={(v) => ubah(b.anggotaId, { kehadiran: v })}
                    >
                      <SelectTrigger aria-label={`Kehadiran ${b.nama}`}>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_KEHADIRAN.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      aria-label={`Keterangan kehadiran ${b.nama}`}
                      value={b.keteranganHadir ?? ""}
                      onChange={(e) => ubah(b.anggotaId, { keteranganHadir: e.target.value })}
                      rows={1}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Media online ${b.nama}`}
                      type="number"
                      min={0}
                      value={b.mediaOnlineTeks}
                      onChange={(e) =>
                        ubah(b.anggotaId, {
                          mediaOnlineTeks: e.target.value,
                          mediaOnline: angkaDari(e.target.value),
                        })
                      }
                      aria-invalid={b.mediaOnlineTeks !== "" && b.mediaOnline === null}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Media offline ${b.nama}`}
                      type="number"
                      min={0}
                      value={b.mediaOfflineTeks}
                      onChange={(e) =>
                        ubah(b.anggotaId, {
                          mediaOfflineTeks: e.target.value,
                          mediaOffline: angkaDari(e.target.value),
                        })
                      }
                      aria-invalid={b.mediaOfflineTeks !== "" && b.mediaOffline === null}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={b.oneOnOne ?? ""}
                      onValueChange={(v) => ubah(b.anggotaId, { oneOnOne: v })}
                    >
                      <SelectTrigger aria-label={`One-on-one ${b.nama}`}>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {CARA_ONE_ON_ONE.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      aria-label={`Keterangan one-on-one ${b.nama}`}
                      value={b.keteranganOneOnOne ?? ""}
                      onChange={(e) => ubah(b.anggotaId, { keteranganOneOnOne: e.target.value })}
                      rows={1}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {berubah.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ubah minimal satu nilai untuk mengirim koreksi.
          </p>
        )}
        <Button onClick={kirim} disabled={!bisaKirim}>
          {busy ? "Menyimpan…" : `Simpan Koreksi (${berubah.length} baris)`}
        </Button>
      </div>
    </div>
  );
}
