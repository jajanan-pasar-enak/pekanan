"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

type Todo = { id: string; text: string; createdAt: string };

export function TodoList() {
  const { data: session } = authClient.useSession();
  const [items, setItems] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/todos");
    const json = (await res.json()) as { todos: Todo[] };
    setItems(json.todos);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const json = (await res.json()) as { todo?: Todo; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed");
      return;
    }
    setText("");
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/todos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
        Postgres (Drizzle, pooled connection)
      </h2>
      {session?.user ? (
        <form onSubmit={add} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="New todo…"
            maxLength={500}
            className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            Add
          </button>
        </form>
      ) : (
        <p className="text-sm opacity-60">Sign in to add or delete todos.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
        {items.length === 0 && <li className="p-3 text-sm opacity-60">No todos yet.</li>}
        {items.map((todo) => (
          <li key={todo.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span>{todo.text}</span>
            {session?.user && (
              <button
                onClick={() => remove(todo.id)}
                className="text-xs opacity-60 hover:text-red-600 hover:opacity-100"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
