import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/config/env";
import type { Hostel, Role } from "@/lib/domain/constants";

/**
 * Stateless sessions: a signed JWT in an httpOnly cookie.
 * `jose` is Web-Crypto based, so the same code runs in the Node runtime and in
 * the proxy without a second implementation.
 */

export const SESSION_COOKIE = "hcms_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  sub: string; // user id
  role: Role;
  name: string;
  email: string;
  hostel?: Hostel;
  regNo?: string;
  /** Must match the user document, otherwise the session is revoked. */
  tv: number;
  mcp?: boolean; // mustChangePassword
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("hcms")
    .setAudience("hcms-web")
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "hcms",
      audience: "hcms-web",
    });
    if (!payload.sub || !payload.role) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
