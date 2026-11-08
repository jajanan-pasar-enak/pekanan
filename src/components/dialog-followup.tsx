"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { kirimApi } from "@/lib/api-client";
import type { FollowupPekan, KonteksFollowupPekan } from "@/lib/klien/followup";

type OpsiHasil = { id: string; nama: string };

type FormNilai = { tanggal: string; hasilFollowupId: string; deskripsi: string };

type Sasaran =
  | { jenis: "tambah"; anggotaId: string; anggotaNama: string; klienId: string }
  | {
      jenis: "ubah";
      anggotaId: string;
      anggotaNama: string;
      followupId: string;
      awal: FollowupPekan;
    };

function namaHasil(opsi: OpsiHasil[], id: unknown): string {
  return opsi.find((o) => o.id === id)?.nama ?? "(hasil tidak dikenal)";
}

function ringkasPerubahan(f: FollowupPekan, opsi: OpsiHasil[]): string[] {
  const terakhir = f.edit.at(-1);
  if (!terakhir) return [];
  const a = terakhir.sebelum;
  const b = terakhir.sesudah;
  const bagian: string[] = [];
  if (a.tanggal !== b.tanggal) bagian.push(`tanggal ${a.tanggal} → ${b.tanggal}`);
  if (a.hasilFollowupId !== b.hasilFollowupId) {
    bagian.push(
      `hasil ${namaHasil(opsi, a.hasilFollowupId)} → ${namaHasil(opsi, b.hasilFollowupId)}`,
    );
  }
  if ((a.deskripsi ?? null) !== (b.deskripsi ?? null)) bagian.push("deskripsi diubah");
  return bagian;
}

function FormFollowup({
  hariIni,
  opsiHasil,
  awal,
  perluAlasan,
  labelKirim,
  busy,
  onSimpan,
  onBatal,
}: {
  hariIni: string;
  opsiHasil: OpsiHasil[];
  awal: FormNilai;
  perluAlasan: boolean;
  labelKirim: string;
  busy: boolean;
  onSimpan: (nilai: FormNilai, alasan: string) => void;
  onBatal: () => void;
}) {
  const [tanggal, setTanggal] = useState(awal.tanggal);
  const [hasilFollowupId, setHasilFollowupId] = useState(awal.hasilFollowupId);
  const [deskripsi, setDeskripsi] = useState(awal.deskripsi);
  const [alasan, setAlasan] = useState("");
  const bisaKirim =
    tanggal !== "" &&
    hasilFollowupId !== "" &&
    (!perluAlasan || alasan.trim() !== "") &&
    !busy;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (bisaKirim) onSimpan({ tanggal, hasilFollowupId, deskripsi }, alasan.trim());
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="fuTanggal">Tanggal kejadian</Label>
          <Input
            id="fuTanggal"
            type="date"
            value={tanggal}
            max={hariIni}
            onChange={(e) => setTanggal(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="fuHasil">Hasil</Label>
          <Select value={hasilFollowupId} onValueChange={setHasilFollowupId}>
            <SelectTrigger id="fuHasil" className="w-full">
              <SelectValue placeholder="Pilih hasil" />
            </SelectTrigger>
            <SelectContent>
              {opsiHasil.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="fuDeskripsi">Deskripsi (opsional)</Label>
        <Textarea
          id="fuDeskripsi"
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          rows={2}
        />
      </div>
      {perluAlasan && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="fuAlasan">Alasan perubahan</Label>
          <Textarea
            id="fuAlasan"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={2}
            placeholder="Contoh: salah memilih hasil; seharusnya Tertarik."
            required
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBatal} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" disabled={!bisaKirim}>
          {busy ? "Menyimpan…" : labelKirim}
        </Button>
      </div>
    </form>
  );
}

async function ambilKonteks(laporanId: string): Promise<KonteksFollowupPekan> {
  const res = await fetch(`/api/laporan/${laporanId}/followup`);
  const json = (await res.json()) as { data?: KonteksFollowupPekan };
  if (!res.ok || !json.data) throw new Error("Gagal memuat follow-up.");
  return json.data;
}

export function DialogFollowup({
  laporanId,
  namaAnggota,
  hariIni,
  konteksAwal,
  opsiHasil,
}: {
  laporanId: string;
  namaAnggota: string;
  hariIni: string;
  konteksAwal: KonteksFollowupPekan;
  opsiHasil: OpsiHasil[];
}) {
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  const [sasaran, setSasaran] = useState<Sasaran | null>(null);
  const [busy, setBusy] = useState(false);
  // Salinan lokal agar perubahan langsung terlihat; server tetap sumber angkanya.
  const [konteks, setKonteks] = useState(konteksAwal);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => setKonteks(konteksAwal), [konteksAwal]);

  const anggota =
    konteks.anggota.find((a) => a.nama === namaAnggota) ??
    konteksAwal.anggota.find((a) => a.nama === namaAnggota);

  async function segarkan() {
    setMemuat(true);
    try {
      setKonteks(await ambilKonteks(laporanId));
    } catch {
      toast.error("Gagal memuat follow-up terbaru.");
    } finally {
      setMemuat(false);
    }
  }

  function buka() {
    setSasaran(null);
    setTerbuka(true);
    void segarkan();
  }

  function tutup(buka: boolean) {
    setTerbuka(buka);
    if (!buka) {
      setSasaran(null);
      router.refresh();
    }
  }

  async function simpan(nilai: FormNilai, alasan: string) {
    if (!sasaran) return;
    setBusy(true);
    try {
      const hasil =
        sasaran.jenis === "tambah"
          ? await kirimApi("POST", `/api/klien/${sasaran.klienId}/followup`, nilai)
          : await kirimApi("PATCH", `/api/followup/${sasaran.followupId}`, {
              ...nilai,
              alasan,
            });
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success(sasaran.jenis === "tambah" ? "Follow-up dicatat." : "Follow-up diperbarui.");
      setSasaran(null);
      await segarkan();
    } finally {
      setBusy(false);
    }
  }

  if (!anggota) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={buka}
        title="Lihat daftar follow-up pekan ini"
        aria-label={`Lihat follow-up ${anggota.nama} pekan ini (${anggota.followup.length})`}
      >
        <ListIcon className="size-4" />
      </Button>

      <Dialog open={terbuka} onOpenChange={tutup}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Follow-up · {anggota.nama}</DialogTitle>
            <DialogDescription>
              Kejadian bertanggal {konteks.pekan.mulai} s.d. {konteks.pekan.selesai} WIB. Angka di
              laporan dihitung dari daftar ini.
            </DialogDescription>
          </DialogHeader>

          {sasaran ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">
                  {sasaran.jenis === "tambah"
                    ? `Catat follow-up untuk ${sasaran.anggotaNama}`
                    : "Ubah follow-up"}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSasaran(null)}>
                  Kembali ke daftar
                </Button>
              </div>
              <FormFollowup
                key={sasaran.jenis === "ubah" ? sasaran.followupId : "baru"}
                hariIni={hariIni}
                opsiHasil={opsiHasil}
                awal={
                  sasaran.jenis === "ubah"
                    ? {
                        tanggal: sasaran.awal.tanggal,
                        hasilFollowupId: sasaran.awal.hasil.id,
                        deskripsi: sasaran.awal.deskripsi ?? "",
                      }
                    : { tanggal: hariIni, hasilFollowupId: "", deskripsi: "" }
                }
                perluAlasan={sasaran.jenis === "ubah"}
                labelKirim={sasaran.jenis === "tambah" ? "Catat follow-up" : "Simpan perubahan"}
                busy={busy}
                onSimpan={simpan}
                onBatal={() => setSasaran(null)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {anggota.followup.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada follow-up klien pada pekan ini.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {anggota.followup.map((f) => (
                    <li key={f.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium">{f.klien.nama}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.tanggal} · {f.hasil.nama}
                            {f.olehSupervisor
                              ? ` · dicatat ${f.olehSupervisor.nama} atas nama ${f.pencatat.nama}`
                              : ""}
                          </p>
                        </div>
                        {f.bolehUbah && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSasaran({
                                jenis: "ubah",
                                anggotaId: anggota.id,
                                anggotaNama: anggota.nama,
                                followupId: f.id,
                                awal: f,
                              })
                            }
                          >
                            <PencilIcon /> Ubah
                          </Button>
                        )}
                      </div>
                      {f.deskripsi && <p className="mt-2 text-sm">{f.deskripsi}</p>}
                      {f.edit.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1 border-l-2 pl-3 text-xs text-muted-foreground">
                          {f.edit.map((e) => (
                            <li key={e.id}>
                              <span className="font-medium">{e.editor.nama}</span> ·{" "}
                              {new Date(e.createdAt).toLocaleString("id-ID")} — {e.alasan}
                              {ringkasPerubahan(f, opsiHasil).length > 0 && (
                                <>
                                  {" "}
                                  <Badge variant="outline" className="align-middle text-[10px]">
                                    {ringkasPerubahan(f, opsiHasil).join("; ")}
                                  </Badge>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {konteks.bolehTambah &&
                (anggota.klien.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {anggota.nama} belum punya klien, sehingga belum ada yang di-follow-up.
                  </p>
                ) : opsiHasil.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Master Hasil Follow-up belum diisi Admin, sehingga follow-up belum bisa dicatat.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">Tambah follow-up</p>
                    <div className="flex flex-wrap gap-2">
                      {anggota.klien.map((k) => (
                        <Button
                          key={k.id}
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSasaran({
                              jenis: "tambah",
                              anggotaId: anggota.id,
                              anggotaNama: anggota.nama,
                              klienId: k.id,
                            })
                          }
                        >
                          <PlusIcon /> {k.nama}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

