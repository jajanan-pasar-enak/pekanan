import { Suspense } from "react";
import { connection } from "next/server";
import { AuthPanel } from "@/components/auth-panel";
import { TodoList } from "@/components/todo-list";
import { functionUrl } from "@/lib/functions";

async function FunctionStatus() {
  await connection();
  let status: string;
  try {
    const res = await fetch(functionUrl("hello"), { cache: "no-store" });
    status = `${res.status} ${await res.text()}`;
  } catch (error) {
    status = `unreachable: ${error instanceof Error ? error.message : String(error)}`;
  }

  return (
    <pre className="overflow-x-auto rounded-lg border border-black/10 p-3 text-xs dark:border-white/15">
      {status}
    </pre>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">pekanan on Neon</h1>
        <p className="text-sm opacity-60">
          Next.js on Vercel, backed by Neon Postgres, Neon Auth, and Neon Functions.
        </p>
      </header>

      <AuthPanel />

      <TodoList />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Neon Function (hello)
        </h2>
        <Suspense fallback={<p className="text-xs opacity-60">Calling function…</p>}>
          <FunctionStatus />
        </Suspense>
      </section>
    </main>
  );
}
