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
import { Textarea } from "@/components/ui/textarea";
import { kirimApi } from "@/lib/api-client";

type OpsiHasil = { id: string; nama: string };

export function FormFollowup({
  klienId,
  hariIni,
  opsiHasil,
}: {
  klienId: string;
  hariIni: string;
  opsiHasil: OpsiHasil[];
}) {
  const router = useRouter();
  const [tanggal, setTanggal] = useState(hariIni);
  const [hasilFollowupId, setHasilFollowupId] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [busy, setBusy] = useState(false);

  const bisaKirim = tanggal !== "" && hasilFollowupId !== "" && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!bisaKirim) return;
    setBusy(true);
    try {
      const hasil = await kirimApi("POST", `/api/klien/${klienId}/followup`, {
        tanggal,
        hasilFollowupId,
        deskripsi,
      });
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success("Follow-up dicatat.");
      setDeskripsi("");
      setHasilFollowupId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (opsiHasil.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Master Hasil Follow-up belum diisi Admin, sehingga follow-up belum bisa dicatat.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="tanggalFollowup">Tanggal kejadian</Label>
          <Input
            id="tanggalFollowup"
            type="date"
            value={tanggal}
            max={hariIni}
            onChange={(e) => setTanggal(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="hasilFollowup">Hasil</Label>
          <Select value={hasilFollowupId} onValueChange={setHasilFollowupId}>
            <SelectTrigger id="hasilFollowup" className="w-full">
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
        <Label htmlFor="deskripsiFollowup">Deskripsi (opsional)</Label>
        <Textarea
          id="deskripsiFollowup"
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          rows={2}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!bisaKirim}>
          {busy ? "Menyimpan…" : "Catat follow-up"}
        </Button>
      </div>
    </form>
  );
}
