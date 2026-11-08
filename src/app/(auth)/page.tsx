import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthPanel } from "@/components/auth-panel";
import { Skeleton } from "@/components/skeleton";
import { bacaSesiSekarang } from "@/lib/auth/current";

function PanelMasukSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6" aria-busy="true">
      <span className="sr-only">Memeriksa sesi…</span>
      <Skeleton className="h-4 w-12" aria-hidden />
      <Skeleton className="h-8 w-full" aria-hidden />
      <Skeleton className="h-4 w-16" aria-hidden />
      <Skeleton className="h-8 w-full" aria-hidden />
      <Skeleton className="h-8 w-full" aria-hidden />
    </div>
  );
}

async function SudahMasuk() {
  await connection();
  if (await bacaSesiSekarang()) redirect("/dashboard");
  return <AuthPanel />;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pekanan</h1>
        <p className="text-sm text-muted-foreground">
          Masuk untuk mencatat kinerja pekanan tim.
        </p>
      </header>
      <Suspense fallback={<PanelMasukSkeleton />}>
        <SudahMasuk />
      </Suspense>
    </main>
  );
}
