"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DialogFollowup } from "@/components/dialog-followup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectBaris } from "@/components/select-baris";
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
import type { KonteksFollowupPekan } from "@/lib/klien/followup";
import { CARA_ONE_ON_ONE, STATUS_KEHADIRAN, type BarisNilai } from "@/lib/laporan/aturan";
import type { BarisLaporan } from "@/lib/laporan/queries";

type StatusSimpan = "bersih" | "menyimpan" | "tersimpan" | "gagal";

type BarisForm = BarisLaporan & {
  mediaOnlineTeks: string;
  mediaOfflineTeks: string;
};

function keBarisForm(b: BarisLaporan): BarisForm {
  return {
    ...b,
    mediaOnlineTeks: b.mediaOnline === null ? "" : String(b.mediaOnline),
    mediaOfflineTeks: b.mediaOffline === null ? "" : String(b.mediaOffline),
  };
}

function potonganBaris(b: BarisForm): BarisNilai {
  return {
    kehadiran: b.kehadiran,
    keteranganHadir: b.keteranganHadir,
    mediaOnline: b.mediaOnline,
    mediaOffline: b.mediaOffline,
    oneOnOne: b.oneOnOne,
    keteranganOneOnOne: b.keteranganOneOnOne,
  };
}

function angkaDari(teks: string): number | null {
  if (teks.trim() === "") return null;
  const n = Number(teks);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function lengkap(b: BarisForm): boolean {
  return (
    b.kehadiran !== null && b.mediaOnline !== null && b.mediaOffline !== null && b.oneOnOne !== null
  );
}

export function FormLaporan({
  laporanId,
  bolehUbah,
  status: statusLaporan,
  barisAwal,
  hariIni,
  konteksFollowup,
  opsiHasil,
}: {
  laporanId: string;
  bolehUbah: boolean;
  status: string;
  barisAwal: BarisLaporan[];
  hariIni: string;
  konteksFollowup: KonteksFollowupPekan;
  opsiHasil: { id: string; nama: string }[];
}) {
  const router = useRouter();
  const [baris, setBaris] = useState<BarisForm[]>(() => barisAwal.map(keBarisForm));
  const [status, setStatus] = useState<Record<string, StatusSimpan>>({});
  const [mengirim, setMengirim] = useState(false);
  // Snapshot terakhir yang tersimpan untuk menghindari PATCH
  // berulang tanpa perubahan dan snapshot sebelum pengeditan. State untuk
  // render, ref untuk simpan() yang async agar selalu membaca nilai terbaru.
  const [snapshot, setSnapshot] = useState(
    () => new Map(barisAwal.map((b) => [b.anggotaId, potonganBaris(keBarisForm(b))])),
  );
  const tersimpan = useRef(snapshot);
  const jeda = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const semuaLengkap = useMemo(() => baris.every(lengkap), [baris]);
  // Kirim hanya ditawarkan bila masih ada baris yang belum lengkap (agar
  // panduan tampil) atau ada nilai yang belum sama dengan snapshot tersimpan.
  const tampilkanKirim =
    bolehUbah &&
    statusLaporan === "Draf" &&
    (!semuaLengkap ||
      baris.some(
        (b) => JSON.stringify(potonganBaris(b)) !== JSON.stringify(snapshot.get(b.anggotaId)),
      ));
  const jumlahLengkap = baris.filter(lengkap).length;

  function ubah(anggotaId: string, patch: Partial<BarisForm>) {
    const berikutnya = baris.map((b) => (b.anggotaId === anggotaId ? { ...b, ...patch } : b));
    setBaris(berikutnya);
    setStatus((s) => ({ ...s, [anggotaId]: "bersih" }));

    // Auto-save tidak boleh bergantung pada blur saja: Select milik Radix
    // menahan fokus di trigger, dan perubahan cepat (ketik + langsung Kirim)
    // bisa belum tersimpan. Simpan setelah jeda mengetik, dan paksa saat blur.
    const terbaru = berikutnya.find((b) => b.anggotaId === anggotaId);
    if (!terbaru || !bolehUbah) return;
    clearTimeout(jeda.current.get(anggotaId));
    jeda.current.set(
      anggotaId,
      setTimeout(() => {
        jeda.current.delete(anggotaId);
        void simpan(anggotaId, terbaru);
      }, 400),
    );
  }

  async function simpan(anggotaId: string, sumber?: BarisForm) {
    if (!bolehUbah) return;
    const terbaru = sumber ?? baris.find((b) => b.anggotaId === anggotaId);
    if (!terbaru) return;
    const sekarang = potonganBaris(terbaru);
    const sebelum = tersimpan.current.get(anggotaId);
    if (sebelum && JSON.stringify(sebelum) === JSON.stringify(sekarang)) return;

    setStatus((s) => ({ ...s, [anggotaId]: "menyimpan" }));
    const hasil = await kirimApi<{ baris: BarisNilai }>(
      "PATCH",
      `/api/laporan/${laporanId}/baris/${anggotaId}`,
      sekarang,
    );
    if (!hasil.ok) {
      setStatus((s) => ({ ...s, [anggotaId]: "gagal" }));
      toast.error(hasil.message);
      return;
    }
    tersimpan.current = new Map(tersimpan.current).set(anggotaId, sekarang);
    setSnapshot(tersimpan.current);
    setStatus((s) => ({ ...s, [anggotaId]: "tersimpan" }));
  }

  function simpanSekarang(anggotaId: string) {
    clearTimeout(jeda.current.get(anggotaId));
    jeda.current.delete(anggotaId);
    void simpan(anggotaId);
  }

  async function kirim() {
    setMengirim(true);
    try {
      const hasil = await kirimApi<{ id: string; status: string }>(
        "POST",
        `/api/laporan/${laporanId}/submit`,
      );
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success("Laporan pekan terkirim.");
      router.refresh();
    } finally {
      setMengirim(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {bolehUbah
            ? "Nilai tersimpan otomatis saat kolom ditinggalkan. Kirim hanya bisa bila semua kolom wajib terisi."
            : "Laporan ini sudah dikirim (atau pekan sudah berakhir) sehingga hanya bisa dibaca."}
        </p>
        <span className="tabular-nums">
          {jumlahLengkap}/{baris.length} baris lengkap
        </span>
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
              <TableHead className="w-24 text-right">Follow-up</TableHead>
              {bolehUbah && <TableHead className="w-24">Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {baris.map((b) => {
              const st = status[b.anggotaId];
              return (
                <TableRow key={b.anggotaId} className={lengkap(b) ? undefined : "bg-muted/40"}>
                  <TableCell className="font-medium">{`${b.nama}`}</TableCell>
                  <TableCell>
                    <SelectBaris
                      label={`Kehadiran ${b.nama}`}
                      value={b.kehadiran}
                      opsi={STATUS_KEHADIRAN}
                      disabled={!bolehUbah}
                      onChange={(v) => ubah(b.anggotaId, { kehadiran: v })}
                      onBlur={() => void simpanSekarang(b.anggotaId)}
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      aria-label={`Keterangan kehadiran ${b.nama}`}
                      value={b.keteranganHadir ?? ""}
                      onChange={(e) => ubah(b.anggotaId, { keteranganHadir: e.target.value })}
                      onBlur={() => void simpanSekarang(b.anggotaId)}
                      readOnly={!bolehUbah}
                      rows={1}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Media online ${b.nama}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={b.mediaOnlineTeks}
                      onChange={(e) =>
                        ubah(b.anggotaId, {
                          mediaOnlineTeks: e.target.value,
                          mediaOnline: angkaDari(e.target.value),
                        })
                      }
                      onBlur={() => void simpanSekarang(b.anggotaId)}
                      readOnly={!bolehUbah}
                      aria-invalid={b.mediaOnlineTeks !== "" && b.mediaOnline === null}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Media offline ${b.nama}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={b.mediaOfflineTeks}
                      onChange={(e) =>
                        ubah(b.anggotaId, {
                          mediaOfflineTeks: e.target.value,
                          mediaOffline: angkaDari(e.target.value),
                        })
                      }
                      onBlur={() => void simpanSekarang(b.anggotaId)}
                      readOnly={!bolehUbah}
                      aria-invalid={b.mediaOfflineTeks !== "" && b.mediaOffline === null}
                    />
                  </TableCell>
                  <TableCell>
                    <SelectBaris
                      label={`One-on-one ${b.nama}`}
                      value={b.oneOnOne}
                      opsi={CARA_ONE_ON_ONE}
                      disabled={!bolehUbah}
                      onChange={(v) => ubah(b.anggotaId, { oneOnOne: v })}
                      onBlur={() => void simpanSekarang(b.anggotaId)}
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      aria-label={`Keterangan one-on-one ${b.nama}`}
                      value={b.keteranganOneOnOne ?? ""}
                      onChange={(e) => ubah(b.anggotaId, { keteranganOneOnOne: e.target.value })}
                      onBlur={() => void simpanSekarang(b.anggotaId)}
                      readOnly={!bolehUbah}
                      rows={1}
                    />
                  </TableCell>
                  {/* Dihitung dari kejadian, bukan diisi di sini; klik untuk melihat/mengelola daftarnya. */}
                  <TableCell className="text-right">
                    <span className="inline-flex items-center">
                      <span className="tabular-nums">{b.followup}</span>
                      <DialogFollowup
                        laporanId={laporanId}
                        namaAnggota={b.nama}
                        hariIni={hariIni}
                        konteksAwal={konteksFollowup}
                        opsiHasil={opsiHasil}
                      />
                    </span>
                  </TableCell>
                  {bolehUbah && (
                    <TableCell className="text-xs text-muted-foreground">
                      {st === "menyimpan"
                        ? "Menyimpan…"
                        : st === "tersimpan"
                          ? "Tersimpan"
                          : st === "gagal"
                            ? "Gagal"
                            : ""}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {tampilkanKirim && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!semuaLengkap && (
            <p className="text-sm text-muted-foreground">
              Lengkapi semua kolom wajib sebelum mengirim.
            </p>
          )}
          <Button onClick={kirim} disabled={!semuaLengkap || mengirim}>
            {mengirim ? "Mengirim…" : "Kirim Laporan"}
          </Button>
        </div>
      )}
    </div>
  );
}
