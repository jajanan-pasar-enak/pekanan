"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Halaman gagal dimuat</CardTitle>
          <CardDescription>
            Terjadi kesalahan saat memuat data. Coba lagi; bila tetap gagal, masuk ulang lalu buka
            halaman ini kembali.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={reset}>Coba lagi</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Ke dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
