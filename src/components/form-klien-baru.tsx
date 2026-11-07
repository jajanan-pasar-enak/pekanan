"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kirimApi } from "@/lib/api-client";

export function FormKlienBaru() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [kontak, setKontak] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const hasil = await kirimApi<{ id: string }>("POST", "/api/klien", {
        nama,
        kontak,
      });
      if (!hasil.ok) {
        toast.error(hasil.message);
        return;
      }
      toast.success(`Klien "${nama.trim()}" ditambahkan.`);
      setNama("");
      setKontak("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="namaKlien">Nama klien</Label>
        <Input
          id="namaKlien"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="kontakKlien">Kontak (opsional)</Label>
        <Input
          id="kontakKlien"
          value={kontak}
          onChange={(e) => setKontak(e.target.value)}
          maxLength={200}
          placeholder="WA / email / alamat"
        />
      </div>
      <Button type="submit" disabled={busy || nama.trim() === ""}>
        {busy ? "Menyimpan…" : "Tambah klien"}
      </Button>
    </form>
  );
}
