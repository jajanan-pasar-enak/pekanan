"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: gagal } = await authClient.signIn.email({ email, password });
      if (gagal) {
        setError(
          gagal.status === 401
            ? "Email atau password salah."
            : "Gagal masuk. Coba lagi."
        );
        return;
      }
      window.location.reload();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-60">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
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
        {busy ? "Memproses…" : "Masuk"}
      </button>
      <p className="text-xs opacity-60">
        Akun dibuat oleh Admin Perhimpunan. Tidak ada pendaftaran mandiri.
      </p>
    </form>
  );
}
