import type { ComponentProps } from "react";
import { cn } from "cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

// Placeholder halaman yang dirender sebagai fallback <Suspense>. Bentuknya
// mengikuti kerangka halaman asli agar staf mengenali halaman yang sedang dimuat.
// Judul/subjudul statis ditampilkan apa adanya; yang dinamis jadi skeleton.
export function HalamanSkeleton({
  judul,
  subjudul,
  aksi,
  anak,
  jumlahBaris = 4,
}: {
  judul?: string;
  subjudul?: string;
  aksi?: React.ReactNode;
  anak?: React.ReactNode;
  jumlahBaris?: number;
}) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>
      <JudulSkeleton judul={judul} subjudul={subjudul} aksi={aksi} />
      {anak ?? <KartuTabelSkeleton jumlahBaris={jumlahBaris} />}
    </div>
  );
}

export function JudulSkeleton({
  judul,
  subjudul,
  aksi,
}: {
  judul?: string;
  subjudul?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        {judul ? (
          <h1 className="text-2xl font-semibold tracking-tight">{judul}</h1>
        ) : (
          <Skeleton className="h-8 w-56" />
        )}
        {subjudul ? (
          <p className="text-sm text-muted-foreground">{subjudul}</p>
        ) : (
          <Skeleton className="h-4 w-80 max-w-full" />
        )}
      </div>
      {aksi}
    </header>
  );
}

export function KartuTabelSkeleton({ jumlahBaris = 4 }: { jumlahBaris?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-6" aria-hidden>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3.5 w-64" />
      <div className="mt-3">
        <BarisTabelSkeleton jumlahBaris={jumlahBaris} />
      </div>
    </div>
  );
}

// Isi tabel tanpa bingkai, untuk dipasang di dalam KartuSkeleton.
export function BarisTabelSkeleton({ jumlahBaris = 4 }: { jumlahBaris?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="h-4 w-full" />
      {Array.from({ length: jumlahBaris }, (_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

export function KartuAnggotaSkeleton({ jumlahBaris = 4 }: { jumlahBaris?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: jumlahBaris }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          {i > 0 && <div className="h-px w-full bg-border" />}
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Tanpa judul: untuk kartu asli yang juga tidak berjudul (mis. isi form laporan).
export function KartuSkeleton({
  judul,
  anak,
  className,
}: {
  judul?: string;
  anak?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-6", className)}>
      {judul && (
        <>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {judul}
            <span className="sr-only">(sedang memuat)</span>
          </h2>
          <Skeleton className="h-3.5 w-64" aria-hidden />
        </>
      )}
      <div className="flex flex-col gap-3" aria-hidden>
        {anak ?? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}
      </div>
    </div>
  );
}

export function IsiKartuSkeleton({ jumlahBaris = 3 }: { jumlahBaris?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: jumlahBaris }, (_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}
