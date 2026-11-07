"use client";

import { authClient } from "@/lib/auth/client";

export function KeluarButton() {
  async function keluar() {
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <button
      onClick={keluar}
      className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
    >
      Keluar
    </button>
  );
}
