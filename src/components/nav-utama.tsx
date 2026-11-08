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
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/dashboard" className="mr-3 font-semibold tracking-tight">
        Pekanan
      </Link>
      {tautan.map(({ href, label }) => {
        const aktif = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 transition-colors hover:bg-muted",
              aktif ? "bg-muted font-medium" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
