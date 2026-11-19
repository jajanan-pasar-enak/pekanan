"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { kirimApi } from "@/lib/api-client";

export type KaryawanAdmin = {
  id: string;
  nama: string;
  email: string;
  level: "Magang" | "Tetap";
  supervisorId: string | null;
  supervisorNama: string | null;
  aktif: boolean;
  harusGantiPassword: boolean;
  peran: string;
  anggotaLangsung: number;
  klien: number;
};

type Pilihan = { id: string; nama: string };
const TANPA_SUPERVISOR = "__tanpa__";

function FormUbah({
  karyawan,
  kandidatSupervisor,
  sayaId,
  onSelesai,
}: {
  karyawan: KaryawanAdmin;
  kandidatSupervisor: Pilihan[];
  sayaId: string;
  onSelesai: () => void;
}) {
  const [nama, setNama] = useState(karyawan.nama);
  const [level, setLevel] = useState<"Magang" | "Tetap">(karyawan.level);
  const [supervisorId, setSupervisorId] = useState(karyawan.supervisorId ?? TANPA_SUPERVISOR);
  const [busy, setBusy] = useState(false);

  const opsiSupervisor = kandidatSupervisor.filter((k) => k.id !== karyawan.id);

  async function simpan(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (nama.trim() !== karyawan.nama) payload.nama = nama.trim();
      if (level !== karyawan.level) payload.level = level;
      const supervisorBaru = supervisorId === TANPA_SUPERVISOR ? null : supervisorId;
      if (supervisorBaru !== karyawan.supervisorId) payload.supervisorId = supervisorBaru;
      if (Object.keys(payload).length === 0) {
        toast.info("Tidak ada perubahan.");
        return;
      }
      const hasil = await kirimApi("PATCH", `/api/admin/karyawan/${karyawan.id}`, payload);
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success(`Data ${karyawan.nama} diperbarui.`);
      onSelesai();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={simpan} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ubahNama">Nama</Label>
        <Input id="ubahNama" value={nama} onChange={(e) => setNama(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ubahLevel">Level</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as "Magang" | "Tetap")}>
            <SelectTrigger id="ubahLevel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tetap">Tetap</SelectItem>
              <SelectItem value="Magang">Magang</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ubahSupervisor">Supervisor</Label>
          <Select value={supervisorId} onValueChange={setSupervisorId}>
            <SelectTrigger id="ubahSupervisor" className="w-full">
              <SelectValue placeholder="Pilih supervisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA_SUPERVISOR}>Tanpa supervisor</SelectItem>
              {opsiSupervisor.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {`${k.nama}`}
                  {k.id === sayaId ? " (saya)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Magang wajib punya supervisor Tetap. Anggota yang dipindah supervisor ikut pindah ke Draf
        laporan supervisor baru. Klien tidak ikut pindah; gunakan Pengambilalihan Klien.
      </p>
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FormBaru({
  kandidatSupervisor,
  onSelesai,
}: {
  kandidatSupervisor: Pilihan[];
  onSelesai: () => void;
}) {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<"Magang" | "Tetap">("Tetap");
  const [supervisorId, setSupervisorId] = useState(TANPA_SUPERVISOR);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  async function simpan(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const hasil = await kirimApi("POST", "/api/admin/karyawan", {
        nama,
        email,
        password,
        level,
        supervisorId: supervisorId === TANPA_SUPERVISOR ? null : supervisorId,
        admin,
      });
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success(`${nama} ditambahkan. Password wajib diganti saat login pertama.`);
      onSelesai();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={simpan} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex flex-col gap-2">
        <Label htmlFor="baruNama">Nama</Label>
        <Input id="baruNama" value={nama} onChange={(e) => setNama(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="baruEmail">Email</Label>
        <Input
          id="baruEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="baruPassword">Password awal (minimal 8 karakter)</Label>
        <Input
          id="baruPassword"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete="off"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="baruLevel">Level</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as "Magang" | "Tetap")}>
            <SelectTrigger id="baruLevel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tetap">Tetap</SelectItem>
              <SelectItem value="Magang">Magang</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="baruSupervisor">Supervisor</Label>
          <Select value={supervisorId} onValueChange={setSupervisorId}>
            <SelectTrigger id="baruSupervisor" className="w-full">
              <SelectValue placeholder="Pilih supervisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA_SUPERVISOR}>Tanpa supervisor</SelectItem>
              {kandidatSupervisor.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {`${k.nama}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={admin}
          onChange={(e) => setAdmin(e.target.checked)}
          className="size-4 accent-primary"
        />
        Jadikan Admin
      </label>
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : "Tambah karyawan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Pindah Tab / ubah `key` akan me-reset state formulir di dalam dialog.
export function KelolaKaryawan({
  karyawan,
  kandidatSupervisor,
  sayaId,
}: {
  karyawan: KaryawanAdmin[];
  kandidatSupervisor: Pilihan[];
  sayaId: string;
}) {
  const router = useRouter();
  const [dialogBaru, setDialogBaru] = useState(false);
  const [ubah, setUbah] = useState<KaryawanAdmin | null>(null);
  const [nonaktif, setNonaktif] = useState<KaryawanAdmin | null>(null);
  const [busy, setBusy] = useState(false);

  function selesai() {
    setDialogBaru(false);
    setUbah(null);
    router.refresh();
  }

  async function jalankanNonaktif() {
    if (!nonaktif) return;
    setBusy(true);
    try {
      const hasil = await kirimApi("PATCH", `/api/admin/karyawan/${nonaktif.id}`, {
        aktif: false,
      });
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success(`${nonaktif.nama} dinonaktifkan; sesinya dicabut.`);
      setNonaktif(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function aktifkan(k: KaryawanAdmin) {
    const hasil = await kirimApi("PATCH", `/api/admin/karyawan/${k.id}`, { aktif: true });
    if (!hasil.ok) {
      toast.error(hasil.message);
      return;
    }
    toast.success(`${k.nama} diaktifkan kembali.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Karyawan</CardTitle>
          <CardDescription>{karyawan.length} profil.</CardDescription>
          <CardAction>
            <Button onClick={() => setDialogBaru(true)}>Tambah karyawan</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead className="text-right">Anggota</TableHead>
                <TableHead className="text-right">Klien</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {karyawan.map((k) => (
                <TableRow key={k.id} className={k.aktif ? undefined : "text-muted-foreground"}>
                  <TableCell className="font-medium">
                    {`${k.nama}`}
                    {k.peran === "admin" && (
                      <Badge variant="secondary" className="ml-2">
                        Admin
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{k.email}</TableCell>
                  <TableCell>{k.level}</TableCell>
                  <TableCell>{k.supervisorNama ?? "Belum ada"}</TableCell>
                  <TableCell className="text-right tabular-nums">{k.anggotaLangsung}</TableCell>
                  <TableCell className="text-right tabular-nums">{k.klien}</TableCell>
                  <TableCell>
                    {k.aktif ? (
                      k.harusGantiPassword ? (
                        <Badge variant="outline">Wajib ganti password</Badge>
                      ) : (
                        <Badge>Aktif</Badge>
                      )
                    ) : (
                      <Badge variant="destructive">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setUbah(k)}>
                        Ubah
                      </Button>
                      {k.aktif ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={k.id === sayaId}
                          onClick={() => setNonaktif(k)}
                        >
                          Nonaktifkan
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => aktifkan(k)}>
                          Aktifkan
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogBaru} onOpenChange={setDialogBaru}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah karyawan</DialogTitle>
            <DialogDescription>
              Akun tidak bisa mendaftar sendiri. Karyawan baru wajib mengganti password.
            </DialogDescription>
          </DialogHeader>
          <FormBaru kandidatSupervisor={kandidatSupervisor} onSelesai={selesai} />
        </DialogContent>
      </Dialog>

      <Dialog open={ubah !== null} onOpenChange={(buka) => !buka && setUbah(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah {ubah?.nama}</DialogTitle>
            <DialogDescription>
              Perubahan level/supervisor ikut memindahkan baris Draf pekan berjalan.
            </DialogDescription>
          </DialogHeader>
          {ubah && (
            <FormUbah
              key={ubah.id}
              karyawan={ubah}
              kandidatSupervisor={kandidatSupervisor}
              sayaId={sayaId}
              onSelesai={selesai}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={nonaktif !== null} onOpenChange={(buka) => !buka && setNonaktif(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan {nonaktif?.nama}?</DialogTitle>
            <DialogDescription>
              Semua sesinya dicabut. Nonaktif ditolak bila masih punya Klien, atau masih membimbing
              Anggota tanpa atasan di atasnya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNonaktif(null)} disabled={busy}>
              Batal
            </Button>
            <Button variant="destructive" onClick={jalankanNonaktif} disabled={busy}>
              {busy ? "Memproses…" : "Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
