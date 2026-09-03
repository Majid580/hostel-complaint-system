"use client";

import type { ApiErrorCode } from "@/lib/api/response";

/**
 * Thin client wrapper so every component handles errors the same way.
 * Throws `ApiClientError`, which carries field-level messages straight to forms.
 */

export class ApiClientError extends Error {
  constructor(
    public code: ApiErrorCode | "NETWORK_ERROR",
    message: string,
    public fields?: Record<string, string>,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; fields?: Record<string, string> } };

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(rest.headers ?? {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "Could not reach the server. Check your internet connection and try again.",
    );
  }

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError(
      "SERVER_ERROR",
      `The server returned an unexpected response (${response.status}).`,
      undefined,
      response.status,
    );
  }

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      payload.error.fields,
      response.status,
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, json?: unknown) => request<T>(path, { method: "POST", json: json ?? {} }),
  patch: <T>(path: string, json?: unknown) => request<T>(path, { method: "PATCH", json: json ?? {} }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Turns any thrown value into something safe to show a user. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function errorFields(error: unknown): Record<string, string> {
  return error instanceof ApiClientError ? (error.fields ?? {}) : {};
}
