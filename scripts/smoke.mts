const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const jar = new Map<string, string>();
const email = `smoke-${Date.now()}@example.com`;
const password = "SmokeTest123!";

function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(res: Response) {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (value === "" || /max-age=0/i.test(raw)) jar.delete(name);
    else jar.set(name, value);
  }
}

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(base + path, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
    redirect: "manual",
  });
  absorb(res);
  const text = await res.text();
  return { status: res.status, text };
}

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ${detail}`);
  if (!ok) process.exitCode = 1;
}

// 1. Postgres (read)
{
  const { status, text } = await call("/api/todos");
  const json = JSON.parse(text) as { todos: { text: string }[] };
  check(
    "postgres read",
    status === 200 && json.todos.length >= 2,
    `status=${status} rows=${json.todos.length} sample=${json.todos.map((t) => t.text).slice(0, 2).join(",")}`,
  );
}

// 2. Unauthenticated write must be rejected
{
  const { status, text } = await call("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "should not be inserted" }),
  });
  check("postgres write blocked without auth", status === 401, `status=${status} body=${text.slice(0, 80)}`);
}

// 3. Neon Auth sign-up
{
  const { status, text } = await call("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base },
    body: JSON.stringify({ email, password, name: "Smoke Test" }),
  });
  const json = JSON.parse(text) as { user?: { email: string }; token?: string };
  check(
    "auth sign-up",
    status === 200 && json.user?.email === email,
    `status=${status} user=${json.user?.email ?? "-"}`,
  );
}

// 4. Session persistence through the Next proxy
{
  const { status, text } = await call("/api/auth/get-session");
  const json = JSON.parse(text) as { user?: { email: string } } | null;
  check(
    "auth session",
    status === 200 && json?.user?.email === email,
    `status=${status} user=${json?.user?.email ?? "-"}`,
  );
}

// 5. Authenticated write (Postgres insert)
{
  const { status, text } = await call("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "tugas dari smoke test" }),
  });
  const json = JSON.parse(text) as { todo?: { id: string; text: string } };
  check(
    "postgres write with session",
    status === 201 && json.todo?.text === "tugas dari smoke test",
    `status=${status} id=${json.todo?.id ?? "-"}`,
  );
  if (json.todo?.id) {
    const del = await call(`/api/todos?id=${encodeURIComponent(json.todo.id)}`, { method: "DELETE" });
    check("postgres delete with session", del.status === 200, `status=${del.status}`);
  }
}

// 6. Validation on write
{
  const { status } = await call("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "" }),
  });
  check("postgres write validation", status === 400, `status=${status}`);
}

// 7. Neon Function through the app
{
  const { status, text } = await call("/api/ping-function");
  const json = JSON.parse(text) as { ok: boolean; body: string };
  check(
    "neon function via app",
    status === 200 && json.ok && json.body === "Hello from Neon Functions",
    `status=${status} body=${json.body ?? "-"}`,
  );
}

// 8. Sign out revokes the session
{
  const out = await call("/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base },
    body: "{}",
  });
  const after = await call("/api/auth/get-session");
  const json = JSON.parse(after.text) as { user?: unknown } | null;
  check(
    "auth sign-out",
    out.status === 200 && !json?.user,
    `signOut=${out.status} sessionUser=${json?.user ? "present" : "none"}`,
  );
}

// 9. Wrong password is rejected as 401 (the case that used to throw unhandled)
{
  const { status, text } = await call("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base },
    body: JSON.stringify({ email, password: "definitely-wrong" }),
  });
  const json = JSON.parse(text) as { code?: string };
  check(
    "auth rejects wrong password",
    status === 401 && json.code === "INVALID_EMAIL_OR_PASSWORD",
    `status=${status} code=${json.code ?? "-"}`,
  );
}

// 10. Sign back in
{
  const { status } = await call("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base },
    body: JSON.stringify({ email, password }),
  });
  const session = await call("/api/auth/get-session");
  const json = JSON.parse(session.text) as { user?: { email: string } } | null;
  check(
    "auth sign-in",
    status === 200 && json?.user?.email === email,
    `status=${status} user=${json?.user?.email ?? "-"}`,
  );
}
