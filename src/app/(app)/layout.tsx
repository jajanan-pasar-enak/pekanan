import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { KeluarButton } from "@/components/keluar-button";
import { requireKaryawan } from "@/lib/auth/current";
import { bootstrapPekan } from "@/lib/pekan/bootstrap";

async function AppShell({ children }: { children: React.ReactNode }) {
  await connection();
  const { sesi, profil } = await requireKaryawan({ izinkanGantiPassword: true });
  if (profil.harusGantiPassword) redirect("/ganti-password");
  await bootstrapPekan(profil.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-semibold">
              Pekanan
            </Link>
            <Link href="/dashboard" className="opacity-70 hover:opacity-100">
              Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="opacity-60">{profil.nama}</span>
            {sesi.user.role === "admin" && (
              <span className="rounded bg-black/10 px-1.5 py-0.5 text-xs dark:bg-white/15">
                Admin
              </span>
            )}
            <KeluarButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
    </div>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
