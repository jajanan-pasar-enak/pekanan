"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kirimApi } from "@/lib/api-client";

export function GantiPasswordForm({ wajib }: { wajib: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [ulangi, setUlangi] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== ulangi) {
      setError("Ulangi password tidak sama.");
      return;
    }
    setBusy(true);
    try {
      const hasil = await kirimApi("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      if (!hasil.ok) {
        setError(hasil.message);
        return;
      }
      // Sesi lain sudah dicabut; cookie ini sudah diganti server.
      window.location.href = "/dashboard";
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4">
      {wajib && <p className="text-sm">Anda wajib mengganti password sebelum memakai aplikasi.</p>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">Password saat ini</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">Password baru (minimal 8 karakter)</Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ulangi">Ulangi password baru</Label>
        <Input
          id="ulangi"
          type="password"
          value={ulangi}
          onChange={(e) => setUlangi(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan password"}
      </Button>
    </form>
  );
}
