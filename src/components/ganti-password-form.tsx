"use client";

import { useState } from "react";

type HasilError = { error?: { code?: string; message?: string } };

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
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const json = (await res.json()) as HasilError;
        setError(
          json.error?.message ??
            (res.status === 401
              ? "Password lama salah."
              : "Password gagal diganti."),
        );
        return;
      }
      // Sesi lain sudah dicabut; cookie ini sudah diganti server.
      window.location.href = "/dashboard";
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      {wajib && (
        <p className="text-sm">
          Anda wajib mengganti password sebelum memakai aplikasi.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">Password saat ini</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">Password baru (minimal 8 karakter)</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">Ulangi password baru</span>
        <input
          type="password"
          value={ulangi}
          onChange={(e) => setUlangi(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? "Menyimpan…" : "Simpan password"}
      </button>
    </form>
  );
}
