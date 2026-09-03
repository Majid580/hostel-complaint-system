import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Every API route answers with the same envelope so the client only ever needs
 * one error path:
 *   { ok: true,  data }
 *   { ok: false, error: { code, message, fields? } }
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ILLEGAL_TRANSITION"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_CONFIGURED"
  | "SERVER_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ILLEGAL_TRANSITION: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  NOT_CONFIGURED: 503,
  SERVER_ERROR: 500,
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string> };
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, { status: 201 });
}

export function fail(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
  status?: number,
) {
  return NextResponse.json<ApiFailure>(
    { ok: false, error: { code, message, ...(fields ? { fields } : {}) } },
    { status: status ?? STATUS_BY_CODE[code] },
  );
}

/** Turns a ZodError into a field-keyed map the forms can render inline. */
export function zodFail(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (!fields[path]) fields[path] = issue.message;
  }
  return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", fields);
}

/**
 * Wraps a route handler so an unexpected throw becomes a clean 500 instead of a
 * stack trace leaking to the browser. Known error shapes are mapped properly.
 */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function handleRoute<T>(fn: () => Promise<T>): Promise<T | ReturnType<typeof fail>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError) return zodFail(error);
    if (error instanceof ApiError) return fail(error.code, error.message, error.fields);

    // Duplicate key from a unique index.
    const mongoError = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (mongoError?.code === 11000) {
      const field = Object.keys(mongoError.keyPattern ?? {})[0] ?? "value";
      return fail("CONFLICT", `That ${field} is already in use.`, {
        [field]: "Already in use.",
      });
    }

    console.error("[api] unhandled error:", error);
    return fail(
      "SERVER_ERROR",
      "Something went wrong on our side. Please try again in a moment.",
    );
  }
}
