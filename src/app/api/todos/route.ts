import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export async function GET() {
  const rows = await db.select().from(todos).orderBy(desc(todos.createdAt)).limit(50);
  return Response.json({ todos: rows });
}

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 500) {
    return Response.json({ error: "text must be 1-500 characters" }, { status: 400 });
  }

  const [row] = await db.insert(todos).values({ text }).returning();
  return Response.json({ todo: row }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const deleted = await db.delete(todos).where(eq(todos.id, id)).returning({ id: todos.id });
  if (deleted.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ deleted: deleted[0].id });
}
