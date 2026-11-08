"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function KeluarButton() {
  async function keluar() {
    await authClient.signOut();
    // Muat penuh agar cache router sesi lama ikut terbuang; replace supaya
    // tombol Back tidak kembali ke halaman yang butuh sesi.
    window.location.replace("/");
  }

  return (
    <Button variant="outline" size="sm" onClick={keluar}>
      Keluar
    </Button>
  );
}
