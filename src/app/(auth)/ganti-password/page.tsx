import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { GantiPasswordForm } from "@/components/ganti-password-form";
import { KeluarButton } from "@/components/keluar-button";
import { requireKaryawan } from "@/lib/auth/current";

async function IsiHalaman() {
  await connection();
  const { profil } = await requireKaryawan({ izinkanGantiPassword: true });
  if (!profil.harusGantiPassword) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ganti Password</h1>
        <p className="text-sm opacity-60">{profil.nama}</p>
      </header>
      <GantiPasswordForm wajib />
      <div>
        <KeluarButton />
      </div>
    </main>
  );
}

export default function GantiPasswordPage() {
  return (
    <Suspense fallback={null}>
      <IsiHalaman />
    </Suspense>
  );
}
