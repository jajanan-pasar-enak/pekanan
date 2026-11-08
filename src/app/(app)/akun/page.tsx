import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { GantiPasswordForm } from "@/components/ganti-password-form";
import { JudulSkeleton } from "@/components/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireKaryawan } from "@/lib/auth/current";

async function HeaderAkun() {
  await connection();
  const { sesi, profil } = await requireKaryawan();

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Akun Saya</h1>
        <p className="text-sm text-muted-foreground">
          {profil.nama} · {sesi.user.email}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{profil.level}</Badge>
        <TombolKembali />
      </div>
    </header>
  );
}

function TombolKembali() {
  return (
    <Button variant="outline" asChild>
      <Link href="/dashboard">Kembali</Link>
    </Button>
  );
}

// Form ganti password tidak bergantung data, jadi langsung tampil; hanya
// header (nama, email, level) yang menunggu sesi.
export default function AkunPage() {
  return (
    <>
      <Suspense fallback={<JudulSkeleton judul="Akun Saya" aksi={<TombolKembali />} />}>
        <HeaderAkun />
      </Suspense>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Ganti Password</CardTitle>
          <CardDescription>
            Setelah disimpan, sesi Anda di perangkat lain akan keluar dan harus masuk ulang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GantiPasswordForm wajib={false} />
        </CardContent>
      </Card>
    </>
  );
}
