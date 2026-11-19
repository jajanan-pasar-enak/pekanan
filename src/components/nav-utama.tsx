"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TAUTAN = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rekap", label: "Rekap" },
  { href: "/klien", label: "Klien" },
  { href: "/iuran", label: "Iuran" },
] as const;

export function NavUtama({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const tautan = admin ? [...TAUTAN, { href: "/admin", label: "Admin" }] : TAUTAN;

  return (
    <nav
      aria-label="Navigasi utama"
      className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm md:justify-center"
    >
      {tautan.map(({ href, label }) => {
        const aktif = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
              aktif
                ? "bg-secondary font-medium text-foreground ring-1 ring-border"
                : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
