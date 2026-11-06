"use client";

import { useState } from "react";
import { isAuthError } from "@neon/auth/next";
import { authClient } from "@/lib/auth/client";

function describeError(error: unknown): string {
  if (isAuthError(error)) return error.message;
  if (error instanceof Error) return `Network error: ${error.message}`;
  return "Authentication failed";
}

export function AuthPanel() {
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "signUp"
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Authentication failed");
        return;
      }
      setPassword("");
      window.location.reload();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError(null);
    setBusy(true);
    try {
      await authClient.signOut();
      window.location.reload();
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  }

  if (isPending) return <p className="text-sm opacity-60">Checking session…</p>;

  if (session?.user) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15">
        <div>
          <p className="text-sm opacity-60">Signed in as</p>
          <p className="font-medium">{session.user.email}</p>
        </div>
        <button
          onClick={signOut}
          disabled={busy}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/20"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("signIn")}
          className={`rounded-md px-3 py-1 ${mode === "signIn" ? "bg-foreground text-background" : "opacity-60"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signUp")}
          className={`rounded-md px-3 py-1 ${mode === "signUp" ? "bg-foreground text-background" : "opacity-60"}`}
        >
          Sign up
        </button>
      </div>
      {mode === "signUp" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min. 8 chars)"
        minLength={8}
        required
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? "Working…" : mode === "signUp" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
