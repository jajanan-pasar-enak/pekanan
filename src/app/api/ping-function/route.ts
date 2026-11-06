import { functionUrl } from "@/lib/functions";

export async function GET() {
  try {
    const res = await fetch(functionUrl("hello"), { cache: "no-store" });
    const body = await res.text();
    return Response.json({ ok: res.ok, status: res.status, body });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
