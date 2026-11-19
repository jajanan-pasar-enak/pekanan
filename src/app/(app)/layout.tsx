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
import { requireKaryawanHalaman } from "@/lib/auth/current";
import { bootstrapPekan } from "@/lib/pekan/bootstrap";

async function AppShell({ children }: { children: React.ReactNode }) {
  await connection();
  const { sesi, profil } = await requireKaryawanHalaman({ izinkanGantiPassword: true });
  if (profil.harusGantiPassword) redirect("/ganti-password");
  await bootstrapPekan(profil.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-2.5 md:grid-cols-[auto_1fr_auto]">
          <Link
            href="/dashboard"
            className="font-display justify-self-start text-lg font-semibold tracking-tight rounded-md focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
          >
            Pekanan
          </Link>
          <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
            <NavUtama admin={sesi.user.role === "admin"} />
          </div>
          <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-3 justify-self-end text-sm md:col-start-3">
            <Link
              href="/akun"
              className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
            >
              <UserIcon className="size-4" aria-hidden />
              <span className="max-w-28 truncate sm:max-w-40" title={profil.nama}>
                {profil.nama}
              </span>
              <span className="sr-only">buka halaman akun dan ganti password</span>
            </Link>
            {sesi.user.role === "admin" && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Admin
              </Badge>
            )}
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
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-2.5 md:grid-cols-[auto_1fr_auto]">
          <Skeleton className="h-4 w-16 justify-self-start" />
          <div
            className="col-span-2 row-start-2 flex min-w-0 items-center gap-1 md:col-span-1 md:col-start-2 md:row-start-1 md:justify-center"
            aria-hidden
          >
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-14" />
          </div>
          <Skeleton
            className="col-start-2 row-start-1 h-7 w-40 justify-self-end md:col-start-3"
            aria-hidden
          />
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
