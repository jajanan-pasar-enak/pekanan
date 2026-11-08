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
export function HalamanSkeleton({
  anak,
  jumlahBaris = 4,
}: {
  anak?: React.ReactNode;
  jumlahBaris?: number;
}) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>
      <div className="flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {anak ?? <KartuTabelSkeleton jumlahBaris={jumlahBaris} />}
    </div>
  );
}

export function KartuTabelSkeleton({ jumlahBaris = 4 }: { jumlahBaris?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-6" aria-hidden>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3.5 w-64" />
      <div className="mt-3 flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        {Array.from({ length: jumlahBaris }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
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

export function KartuSkeleton({
  judul,
  anak,
  className,
}: {
  judul: string;
  anak?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-6", className)}>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {judul}
        <span className="sr-only">(sedang memuat)</span>
      </h2>
      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-3.5 w-64" />
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
