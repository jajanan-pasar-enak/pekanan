"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";
import { DialogFollowup } from "@/components/dialog-followup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectBaris } from "@/components/select-baris";
import { Textarea } from "@/components/ui/textarea";
import { kirimApi } from "@/lib/api-client";
import type { KonteksFollowupPekan } from "@/lib/klien/followup";
import {
  CARA_ONE_ON_ONE,
  STATUS_KEHADIRAN,
  kolomKosong,
  type BarisNilai,
} from "@/lib/laporan/aturan";
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

function labelSimpan(st: StatusSimpan | undefined): string | null {
  if (st === "gagal") return "Gagal disimpan";
  if (st === "menyimpan") return "Menyimpan…";
  return null;
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
  // Buka anggota pertama yang belum lengkap; kalau semua lengkap, anggota pertama.
  const [aktifId, setAktifId] = useState(() => {
    const belum = barisAwal.find((b) => kolomKosong(keBarisForm(b)).length > 0);
    return (belum ?? barisAwal[0])?.anggotaId ?? "";
  });
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
  // Simpanan per anggota diantrekan agar PATCH lama tidak menimpa yang baru.
  const antrean = useRef(new Map<string, Promise<boolean>>());

  useEffect(() => {
    const timer = jeda.current;
    return () => {
      for (const t of timer.values()) clearTimeout(t);
    };
  }, []);

  const semuaLengkap = useMemo(() => baris.every(lengkap), [baris]);
  const jumlahLengkap = baris.filter(lengkap).length;
  const adaGagal = Object.values(status).includes("gagal");
  const adaMenyimpan = Object.values(status).includes("menyimpan");
  const adaBelumTersimpan = baris.some((b) => {
    const sebelum = snapshot.get(b.anggotaId);
    return !sebelum || JSON.stringify(sebelum) !== JSON.stringify(potonganBaris(b));
  });
  const bisaKirim = bolehUbah && statusLaporan === "Draf";
  const tombolNonaktif = !semuaLengkap || mengirim || adaGagal || adaMenyimpan;

  const keadaanSimpan = adaGagal
    ? "Ada perubahan yang gagal disimpan."
    : adaMenyimpan
      ? "Menyimpan perubahan…"
      : adaBelumTersimpan
        ? "Perubahan belum tersimpan."
        : "Semua perubahan tersimpan.";

  const aktif = baris.find((b) => b.anggotaId === aktifId) ?? baris[0];
  const persen = baris.length > 0 ? Math.round((jumlahLengkap / baris.length) * 100) : 0;
  if (!aktif) return null;
  const kosongAktif = kolomKosong(aktif).length;
  const k = kontrol(aktif);

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

  function simpan(anggotaId: string, sumber?: BarisForm): Promise<boolean> {
    if (!bolehUbah) return Promise.resolve(true);
    const terbaru = sumber ?? baris.find((b) => b.anggotaId === anggotaId);
    if (!terbaru) return Promise.resolve(true);
    const sekarang = potonganBaris(terbaru);
    const sebelum = tersimpan.current.get(anggotaId);
    if (sebelum && JSON.stringify(sebelum) === JSON.stringify(sekarang)) {
      return Promise.resolve(true);
    }

    const antre = antrean.current.get(anggotaId) ?? Promise.resolve(true);
    const janji = antre
      .then(async () => {
        setStatus((s) => ({ ...s, [anggotaId]: "menyimpan" }));
        const hasil = await kirimApi<{ baris: BarisNilai }>(
          "PATCH",
          `/api/laporan/${laporanId}/baris/${anggotaId}`,
          sekarang,
        );
        if (!hasil.ok) {
          setStatus((s) => ({ ...s, [anggotaId]: "gagal" }));
          toast.error(hasil.message);
          return false;
        }
        tersimpan.current = new Map(tersimpan.current).set(anggotaId, sekarang);
        setSnapshot(tersimpan.current);
        setStatus((s) => ({ ...s, [anggotaId]: "tersimpan" }));
        return true;
      })
      .catch(() => {
        setStatus((s) => ({ ...s, [anggotaId]: "gagal" }));
        toast.error("Perubahan gagal disimpan.");
        return false;
      });
    antrean.current.set(anggotaId, janji);
    return janji;
  }

  function simpanSekarang(anggotaId: string) {
    clearTimeout(jeda.current.get(anggotaId));
    jeda.current.delete(anggotaId);
    void simpan(anggotaId);
  }

  async function kirim() {
    if (!semuaLengkap || mengirim) return;
    setMengirim(true);
    try {
      // Tunggu setiap simpanan tertunda selesai sebelum submit, agar nilai
      // yang baru diketik tidak tertinggal di balik jeda auto-save.
      const hasilSimpan = await Promise.all(
        baris.map((b) => {
          clearTimeout(jeda.current.get(b.anggotaId));
          jeda.current.delete(b.anggotaId);
          return simpan(b.anggotaId);
        }),
      );
      if (hasilSimpan.some((ok) => !ok)) {
        toast.error("Perubahan belum tersimpan. Coba kirim lagi.");
        return;
      }
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

  function kontrol(b: BarisForm) {
    return {
      kehadiran: (
        <SelectBaris
          label={`Kehadiran ${b.nama}`}
          value={b.kehadiran}
          opsi={STATUS_KEHADIRAN}
          disabled={!bolehUbah}
          onChange={(v) => ubah(b.anggotaId, { kehadiran: v })}
          onBlur={() => void simpanSekarang(b.anggotaId)}
        />
      ),
      keteranganHadir: (
        <Textarea
          aria-label={`Keterangan kehadiran ${b.nama}`}
          value={b.keteranganHadir ?? ""}
          onChange={(e) => ubah(b.anggotaId, { keteranganHadir: e.target.value })}
          onBlur={() => void simpanSekarang(b.anggotaId)}
          readOnly={!bolehUbah}
          rows={2}
        />
      ),
      mediaOnline: (
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
      ),
      mediaOffline: (
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
      ),
      oneOnOne: (
        <SelectBaris
          label={`One-on-one ${b.nama}`}
          value={b.oneOnOne}
          opsi={CARA_ONE_ON_ONE}
          disabled={!bolehUbah}
          onChange={(v) => ubah(b.anggotaId, { oneOnOne: v })}
          onBlur={() => void simpanSekarang(b.anggotaId)}
        />
      ),
      keteranganOneOnOne: (
        <Textarea
          aria-label={`Keterangan one-on-one ${b.nama}`}
          value={b.keteranganOneOnOne ?? ""}
          onChange={(e) => ubah(b.anggotaId, { keteranganOneOnOne: e.target.value })}
          onBlur={() => void simpanSekarang(b.anggotaId)}
          readOnly={!bolehUbah}
          rows={2}
        />
      ),
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm tabular-nums">
          <span className="font-medium">{jumlahLengkap}</span> dari {baris.length} anggota lengkap
        </p>
        <div
          role="progressbar"
          aria-label="Kelengkapan laporan pekan"
          aria-valuemin={0}
          aria-valuemax={baris.length}
          aria-valuenow={jumlahLengkap}
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-signal" style={{ width: `${persen}%` }} />
        </div>
        <p className="w-full text-sm text-muted-foreground md:flex-1 md:text-right">
          {bolehUbah
            ? "Perubahan tersimpan otomatis. Kirim tersedia setelah semua kolom wajib terisi."
            : "Laporan ini sudah dikirim (atau pekan sudah berakhir) sehingga hanya bisa dibaca."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
        <div
          role="group"
          aria-label="Pilih anggota laporan"
          className="flex gap-1 overflow-x-auto rounded-xl bg-card p-1.5 ring-1 ring-foreground/10 md:flex-col md:overflow-visible"
        >
          {baris.map((b) => {
            const terpilih = b.anggotaId === aktif.anggotaId;
            const kosong = kolomKosong(b).length;
            const st = labelSimpan(status[b.anggotaId]);
            return (
              <button
                key={b.anggotaId}
                type="button"
                onClick={() => setAktifId(b.anggotaId)}
                aria-pressed={terpilih}
                className={cn(
                  "flex shrink-0 flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none md:w-full",
                  terpilih ? "bg-muted ring-1 ring-foreground/10" : "hover:bg-muted/60",
                )}
              >
                <span className="max-w-40 truncate font-medium md:max-w-none md:whitespace-normal">
                  {b.nama}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    status[b.anggotaId] === "gagal"
                      ? "text-destructive"
                      : kosong === 0
                        ? "text-signal"
                        : "text-muted-foreground",
                  )}
                >
                  {st ?? (kosong === 0 ? "Lengkap" : `${kosong} kolom kosong`)}
                </span>
              </button>
            );
          })}
        </div>

        <section
          aria-labelledby={`editor-${aktif.anggotaId}`}
          className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id={`editor-${aktif.anggotaId}`} className="font-medium break-words">
                {aktif.nama}
              </h2>
              <p
                className={cn(
                  "text-xs",
                  status[aktif.anggotaId] === "gagal"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {labelSimpan(status[aktif.anggotaId]) ??
                  (kosongAktif === 0 ? "Lengkap" : `${kosongAktif} kolom wajib belum terisi`)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="tabular-nums">{aktif.followup}</span>
              <span className="text-muted-foreground">follow-up</span>
              <DialogFollowup
                laporanId={laporanId}
                namaAnggota={aktif.nama}
                hariIni={hariIni}
                konteksAwal={konteksFollowup}
                opsiHasil={opsiHasil}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Kehadiran</span>
              {k.kehadiran}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">One-on-one</span>
              {k.oneOnOne}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Media online</span>
              {k.mediaOnline}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Media offline</span>
              {k.mediaOffline}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Keterangan kehadiran</span>
              {k.keteranganHadir}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Keterangan one-on-one</span>
              {k.keteranganOneOnOne}
            </div>
          </div>

          {bolehUbah && <p className="text-xs text-muted-foreground">{keadaanSimpan}</p>}
        </section>
      </div>

      {bisaKirim && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm tabular-nums">
              {jumlahLengkap}/{baris.length} baris lengkap
            </p>
            <p className={cn("text-xs", adaGagal ? "text-destructive" : "text-muted-foreground")}>
              {keadaanSimpan}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!semuaLengkap && (
              <p className="text-xs text-muted-foreground">
                Lengkapi semua kolom wajib sebelum mengirim.
              </p>
            )}
            <Button
              type="button"
              onClick={() => void kirim()}
              disabled={tombolNonaktif}
              className="active:translate-y-px"
            >
              {mengirim ? "Mengirim…" : "Kirim laporan"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
