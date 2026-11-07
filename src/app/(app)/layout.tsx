import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { KeluarButton } from "@/components/keluar-button";
import { NavUtama } from "@/components/nav-utama";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { requireKaryawan } from "@/lib/auth/current";
import { bootstrapPekan } from "@/lib/pekan/bootstrap";

async function AppShell({ children }: { children: React.ReactNode }) {
  await connection();
  const { sesi, profil } = await requireKaryawan({ izinkanGantiPassword: true });
  if (profil.harusGantiPassword) redirect("/ganti-password");
  await bootstrapPekan(profil.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          <NavUtama admin={sesi.user.role === "admin"} />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{profil.nama}</span>
            {sesi.user.role === "admin" && <Badge variant="secondary">Admin</Badge>}
            <KeluarButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
      <Toaster position="top-center" richColors />
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
