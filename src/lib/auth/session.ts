import { cache } from "react";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models";
import { ApiError } from "@/lib/api/response";
import type { Actor } from "./permissions";
import type { Role } from "@/lib/domain/constants";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "./jwt";

/**
 * Two levels of session access:
 *
 *   getSession()      — cookie + signature only. Cheap, no DB round trip.
 *                       Good enough for rendering a nav bar.
 *   getCurrentUser()  — additionally verifies the user still exists, is active
 *                       and that `tokenVersion` matches (instant revocation).
 *                       Used by every mutating route.
 */

/**
 * Wrapped in React's `cache()`, so the cookie is verified at most once per
 * request no matter how many callers ask.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
});

export type CurrentUser = Actor & {
  regNo?: string;
  mustChangePassword: boolean;
  emailVerified: boolean;
};

/**
 * Short-lived cache of the account check, held in the warm container.
 *
 * Verifying a session costs one Atlas round trip, and from a free M0 cluster
 * that is 120-300 ms — paid by EVERY authenticated request before any of the
 * page's own work starts. Holding the result for a few seconds removes that
 * floor.
 *
 * The trade: deactivating an account or forcing a sign-out can take up to
 * SESSION_CACHE_TTL_MS to be seen by an already-warm container (other
 * containers have their own copies). `invalidateUserSession()` clears it
 * immediately on the instance that performed the change, so the delay only
 * applies to instances that did not. Set SESSION_CACHE_TTL_MS=0 to disable the
 * cache entirely and check the database on every request.
 */
type SessionCacheEntry = { value: CurrentUser | null; fetchedAt: number };

const globalForSession = globalThis as unknown as {
  __hcmsSessionCache?: Map<string, SessionCacheEntry>;
};
const sessionCache = (globalForSession.__hcmsSessionCache ??= new Map());

const SESSION_CACHE_TTL_MS = (() => {
  const raw = process.env.SESSION_CACHE_TTL_MS;
  const parsed = raw === undefined ? 15_000 : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 15_000;
})();

/** Drops the cached account check so the next request re-reads the database. */
export function invalidateUserSession(userId?: string): void {
  if (!userId) {
    sessionCache.clear();
    return;
  }
  for (const key of sessionCache.keys()) {
    if (key.startsWith(`${userId}:`)) sessionCache.delete(key);
  }
}

async function loadUserForSession(session: SessionPayload): Promise<CurrentUser | null> {
  await connectDB();
  const user = await User.findById(session.sub)
    .select("role name email hostel regNo isActive tokenVersion mustChangePassword emailVerified")
    .lean();

  if (!user || !user.isActive) return null;
  if ((user.tokenVersion ?? 0) !== (session.tv ?? 0)) return null;

  return {
    id: String(user._id),
    role: user.role,
    name: user.name,
    email: user.email,
    hostel: user.hostel,
    regNo: user.regNo,
    mustChangePassword: Boolean(user.mustChangePassword),
    emailVerified: Boolean(user.emailVerified),
  };
}

/**
 * Also `cache()`d, so a page and its layout — or two guards in one API route —
 * share a single lookup within a request, on top of the cross-request cache.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  if (SESSION_CACHE_TTL_MS === 0) return loadUserForSession(session);

  // Keyed by token version too, so a re-issued token never reads a stale entry.
  const key = `${session.sub}:${session.tv ?? 0}`;
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < SESSION_CACHE_TTL_MS) return hit.value;

  const value = await loadUserForSession(session);
  sessionCache.set(key, { value, fetchedAt: Date.now() });

  // The map is per-container and tiny, but bound it anyway.
  if (sessionCache.size > 500) {
    for (const [k, v] of sessionCache) {
      if (Date.now() - v.fetchedAt >= SESSION_CACHE_TTL_MS) sessionCache.delete(k);
    }
  }

  return value;
});

/* --- Route guards ---------------------------------------------------------- */

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new ApiError("FORBIDDEN", "You do not have permission to do that.");
  }
  return user;
}

export async function requireStaff(): Promise<CurrentUser> {
  return requireRole("RT", "WARDEN", "COORDINATOR");
}

export async function requireStudent(): Promise<CurrentUser> {
  return requireRole("STUDENT");
}

/* --- Cookie helpers -------------------------------------------------------- */

export async function establishSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}
