import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PASSWORD_CHANGE_REQUIRED"
  | "INACTIVE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "INTERNAL";

const statusPerKode: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  INACTIVE: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = statusPerKode[code];
    this.details = details;
  }
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function jsonError(
  code: ErrorCode,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status: statusPerKode[code] },
  );
}

// ZodError ditangani terpisah agar semua error validasi memakai format
// { error: { code: "VALIDATION", message, details: { issues } } }.
export function validationError(error: ZodError): NextResponse {
  return jsonError("VALIDATION", "Data yang dikirim tidak valid.", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function bacaJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION", "Body harus berupa JSON yang valid.");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === "23505";
}

function isBetterAuthApiError(
  error: unknown,
): error is { status: string; body?: { message?: string; code?: string } } {
  return (
    error instanceof Error &&
    error.name === "APIError" &&
    typeof (error as { status?: unknown }).status === "string"
  );
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      return jsonError(error.code, error.message, error.details);
    }
    if (error instanceof ZodError) {
      return validationError(error);
    }
    if (isBetterAuthApiError(error)) {
      if (error.status === "UNAUTHORIZED") {
        return jsonError("UNAUTHORIZED", "Sesi tidak valid. Silakan masuk lagi.");
      }
      if (error.status === "FORBIDDEN") {
        return jsonError("FORBIDDEN", error.body?.message ?? "Akses ditolak.");
      }
      return jsonError(
        error.status === "BAD_REQUEST" ? "VALIDATION" : "INTERNAL",
        error.body?.message ?? "Permintaan gagal.",
        error.body?.code ? { kode: error.body.code } : undefined,
      );
    }
    if (isUniqueViolation(error)) {
      return jsonError("CONFLICT", "Data ini sudah tercatat.");
    }
    console.error(error);
    return jsonError("INTERNAL", "Terjadi kesalahan pada server.");
  }
}
