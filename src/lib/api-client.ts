export type HasilApi<T> = { ok: true; data: T } | { ok: false; message: string; status: number };

type Amplop<T> = { data?: T; error?: { code?: string; message?: string } };

export async function kirimApi<T>(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<HasilApi<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, message: "Tidak dapat menghubungi server." };
  }
  let json: Amplop<T> = {};
  try {
    json = (await res.json()) as Amplop<T>;
  } catch {
    // Respons kosong/non-JSON: cukup pakai status.
  }
  if (res.ok) return { ok: true, data: json.data as T };
  return {
    ok: false,
    status: res.status,
    message: json.error?.message ?? "Permintaan gagal. Coba lagi.",
  };
}
