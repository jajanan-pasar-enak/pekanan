"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { kirimApi } from "@/lib/api-client";

type Hasil = { id: string; nama: string; urutan: number; aktif: boolean };

export function MasterHasilFollowup({ hasil }: { hasil: Hasil[] }) {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [urutan, setUrutan] = useState("");
  const [busy, setBusy] = useState(false);

  const urutanAngka = urutan === "" ? 0 : Number(urutan);
  const sah = nama.trim() !== "" && Number.isInteger(urutanAngka) && urutanAngka >= 0 && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!sah) return;
    setBusy(true);
    try {
      const hasilApi = await kirimApi("POST", "/api/hasil-followup", {
        nama,
        urutan: urutanAngka,
        aktif: true,
      });
      if (!hasilApi.ok) {
        toast.error(hasilApi.message);
        return;
      }
      toast.success(`Hasil follow-up "${nama.trim()}" ditambahkan.`);
      setNama("");
      setUrutan("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Master Hasil Follow-up</CardTitle>
        <CardDescription>
          Pilihan hasil saat mencatat follow-up; urutan kecil tampil lebih dulu.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-[2] flex-col gap-2">
            <Label htmlFor="hasilNama">Nama</Label>
            <Input
              id="hasilNama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Tertarik lanjut"
              maxLength={100}
              required
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="hasilUrutan">Urutan</Label>
            <Input
              id="hasilUrutan"
              type="number"
              min={0}
              step={1}
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
              placeholder="0"
            />
          </div>
          <Button type="submit" disabled={!sah}>
            {busy ? "Menyimpan…" : "Tambah hasil"}
          </Button>
        </form>

        {hasil.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada hasil follow-up.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Urutan</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasil.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="tabular-nums">{h.urutan}</TableCell>
                  <TableCell className="font-medium">{h.nama}</TableCell>
                  <TableCell>
                    {h.aktif ? <Badge>Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
