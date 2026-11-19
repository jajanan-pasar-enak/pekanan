import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthPanel } from "@/components/auth-panel";
import { bacaSesiSekarang } from "@/lib/auth/current";

async function TolakYangSudahMasuk() {
  await connection();
  if (await bacaSesiSekarang()) redirect("/dashboard");
  return null;
}

// Form tidak bergantung data, jadi langsung tampil; hanya pemeriksaan sesi
// (yang berujung redirect) yang ditunda.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pekanan</h1>
        <p className="text-sm text-muted-foreground">Masuk untuk mencatat kinerja pekanan tim.</p>
      </header>
      <Suspense fallback={null}>
        <TolakYangSudahMasuk />
      </Suspense>
      <AuthPanel />
    </main>
  );
}
