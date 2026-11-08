import assert from "node:assert/strict";
import { test } from "node:test";
import { APIError } from "better-auth";
import { z } from "zod";
import { AppError, handle, jsonOk } from "./http";

test("AppError memetakan kode ke status", () => {
  const kasus: [ConstructorParameters<typeof AppError>[0], number][] = [
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["PASSWORD_CHANGE_REQUIRED", 403],
    ["INACTIVE", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["VALIDATION", 400],
    ["INTERNAL", 500],
  ];
  for (const [kode, status] of kasus) {
    assert.equal(new AppError(kode, "x").status, status, kode);
  }
});

test("jsonOk membungkus data", async () => {
  const res = jsonOk({ a: 1 }, 201);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { data: { a: 1 } });
});

test("handle: AppError → { error: { code, message } }", async () => {
  const res = await handle(async () => {
    throw new AppError("CONFLICT", "Sudah ada.", { field: "bulan" });
  });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {
    error: { code: "CONFLICT", message: "Sudah ada.", details: { field: "bulan" } },
  });
});

test("handle: ZodError → VALIDATION 400 dengan detail", async () => {
  const skema = z.object({ nama: z.string().min(1) });
  const res = await handle(async () => jsonOk(skema.parse({ nama: "" })));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "VALIDATION");
  assert.equal(body.error.details.issues[0].path, "nama");
  assert.ok(body.error.details.issues.length > 0);
});

test("handle: APIError UNAUTHORIZED / FORBIDDEN diterjemahkan", async () => {
  const un = await handle(async () => {
    throw new APIError("UNAUTHORIZED", { message: "Sesi habis" });
  });
  assert.equal(un.status, 401);
  assert.equal((await un.json()).error.code, "UNAUTHORIZED");

  const fb = await handle(async () => {
    throw new APIError("FORBIDDEN", { message: "Tidak boleh" });
  });
  assert.equal(fb.status, 403);
  assert.equal((await fb.json()).error.message, "Tidak boleh");
});

test("handle: error tak dikenal → INTERNAL 500 tanpa bocoran", async () => {
  const res = await handle(async () => {
    throw new Error("rahasia internal");
  });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, "INTERNAL");
  assert.notEqual(body.error.message, "rahasia internal");
});
