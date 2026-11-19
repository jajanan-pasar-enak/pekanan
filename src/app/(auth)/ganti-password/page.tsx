import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { GantiPasswordForm } from "@/components/ganti-password-form";
import { KeluarButton } from "@/components/keluar-button";
import { Skeleton } from "@/components/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { requireKaryawanHalaman } from "@/lib/auth/current";

async function PenjagaGantiPassword() {
  await connection();
  const { profil } = await requireKaryawanHalaman({ izinkanGantiPassword: true });
  if (!profil.harusGantiPassword) redirect("/dashboard");

  return <p className="text-sm text-muted-foreground">{profil.nama}</p>;
}

// Form tidak bergantung data, jadi langsung tampil; hanya nama pemilik (dan
// redirect bila kewajiban ganti password sudah selesai) yang menunggu sesi.
export default function GantiPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ganti Password</h1>
        <Suspense fallback={<Skeleton className="h-4 w-32" />}>
          <PenjagaGantiPassword />
        </Suspense>
      </header>
      <Card>
        <CardContent>
          <GantiPasswordForm wajib />
        </CardContent>
      </Card>
      <div>
        <KeluarButton />
      </div>
    </main>
  );
}
