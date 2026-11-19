import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Halaman tidak ditemukan</CardTitle>
          <CardDescription>
            Alamat ini tidak ada, atau datanya sudah tidak tersedia untuk akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Ke dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
