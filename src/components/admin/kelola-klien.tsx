"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type Pilihan = { id: string; nama: string };

export function KelolaKlien({ karyawan }: { karyawan: Pilihan[] }) {
  const router = useRouter();
  const [klienId, setKlienId] = useState("");
  const [keKaryawanId, setKeKaryawanId] = useState("");
  const [busy, setBusy] = useState(false);

  const sah = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    klienId.trim(),
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!sah || keKaryawanId === "" || busy) return;
    setBusy(true);
    try {
      const hasil = await kirimApi<{ id: string; pemilik: { nama: string } }>(
        "POST",
        `/api/klien/${klienId.trim()}/alih`,
        { keKaryawanId },
      );
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success(`Klien dialihkan ke ${hasil.data.pemilik.nama}.`);
      setKlienId("");
      setKeKaryawanId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengambilalihan Klien</CardTitle>
        <CardDescription>
          Klien punya satu pemilik. Bila pemilik nonaktif atau pindah supervisor, kliennya harus
          dialihkan ke karyawan aktif lain. Admin tidak melihat riwayat follow-up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-[2] flex-col gap-2">
            <Label htmlFor="klienId">ID klien</Label>
            <Input
              id="klienId"
              value={klienId}
              onChange={(e) => setKlienId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="font-mono"
              aria-invalid={klienId !== "" && !sah}
            />
          </div>
          <div className="flex flex-[2] flex-col gap-2">
            <Label htmlFor="pemilikBaru">Pemilik baru</Label>
            <Select value={keKaryawanId} onValueChange={setKeKaryawanId}>
              <SelectTrigger id="pemilikBaru" className="w-full">
                <SelectValue placeholder="Pilih karyawan aktif" />
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
          <Button type="submit" disabled={!sah || keKaryawanId === "" || busy}>
            {busy ? "Mengalihkan…" : "Alihkan klien"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
