import Link from "next/link";
import { UserIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { KeluarButton } from "@/components/keluar-button";
import { NavUtama } from "@/components/nav-utama";
import { Skeleton } from "@/components/skeleton";
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
            <Link
              href="/akun"
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <UserIcon className="size-4" aria-hidden />
              <span>{profil.nama}</span>
              <span className="sr-only">— buka halaman akun dan ganti password</span>
            </Link>
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

// Tampil saat muat penuh sebelum sesi/profil siap. Navbar tidak memuat nama
// pengguna karena profil belum tentu tersedia.
function KerangkaAplikasi() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          <div className="flex items-center gap-2" aria-hidden>
            <Skeleton className="mr-3 h-4 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-14" />
          </div>
          <Skeleton className="h-7 w-40" aria-hidden />
        </div>
      </header>
    </div>
  );
}

// children sengaja di luar Suspense shell: saat pindah rute, Suspense di
// layout tidak menampilkan fallback-nya, jadi skeleton per halaman yang
// berperan (paralel, tidak berurutan dengan sesi).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<KerangkaAplikasi />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
