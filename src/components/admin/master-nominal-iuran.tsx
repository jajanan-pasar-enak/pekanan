"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type Nominal = { id: string; nama: string; nominal: number; aktif: boolean };

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function MasterNominalIuran({ nominal }: { nominal: Nominal[] }) {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [nilai, setNilai] = useState("");
  const [busy, setBusy] = useState(false);

  const angka = Number(nilai);
  const sah = nama.trim() !== "" && Number.isInteger(angka) && angka >= 0 && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!sah) return;
    setBusy(true);
    try {
      const hasil = await kirimApi("POST", "/api/nominal-iuran", {
        nama,
        nominal: angka,
        aktif: true,
      });
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success(`Nominal "${nama.trim()}" ditambahkan.`);
      setNama("");
      setNilai("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Master Nominal Iuran</CardTitle>
        <CardDescription>
          Hanya nominal aktif yang bisa dipilih saat mencatat pembayaran.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="nominalNama">Nama</Label>
            <Input
              id="nominalNama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Iuran Bulanan"
              maxLength={100}
              required
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="nominalNilai">Nominal (Rp)</Label>
            <Input
              id="nominalNilai"
              type="number"
              min={0}
              step={1}
              value={nilai}
              onChange={(e) => setNilai(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={!sah}>
            {busy ? "Menyimpan…" : "Tambah nominal"}
          </Button>
        </form>

        {nominal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada nominal.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nominal.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.nama}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rupiah.format(n.nominal)}
                  </TableCell>
                  <TableCell>
                    {n.aktif ? <Badge>Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
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
