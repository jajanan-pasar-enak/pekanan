"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function KeluarButton() {
  async function keluar() {
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <Button variant="outline" size="sm" onClick={keluar}>
      Keluar
    </Button>
  );
}
