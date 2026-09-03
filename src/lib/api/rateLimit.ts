import { connectDB } from "@/lib/db/mongoose";
import { RateLimit } from "@/models";
import { ApiError } from "./response";

/**
 * Serverless-safe rate limiting.
 *
 * In-memory counters are useless on Vercel: each request may land on a
 * different instance. A single atomic `findOneAndUpdate` per check is cheap and
 * correct, and the TTL index cleans up after itself.
 */

export type RateLimitRule = {
  /** Requests allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  otp: { limit: 3, windowSeconds: 10 * 60 },
  createComplaint: { limit: 5, windowSeconds: 24 * 60 * 60 },
  comment: { limit: 30, windowSeconds: 60 * 60 },
  upload: { limit: 40, windowSeconds: 60 * 60 },
  escalate: { limit: 3, windowSeconds: 24 * 60 * 60 },
  generic: { limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name];
  const now = new Date();
  const key = `${name}:${identifier}`;

  await connectDB();

  const existing = await RateLimit.findOne({ key }).lean();
  const windowExpired =
    !existing || now.getTime() - new Date(existing.windowStart).getTime() >= rule.windowSeconds * 1000;

  if (windowExpired) {
    const expiresAt = new Date(now.getTime() + rule.windowSeconds * 1000);
    await RateLimit.findOneAndUpdate(
      { key },
      { $set: { count: 1, windowStart: now, expiresAt } },
      { upsert: true },
    );
    return { allowed: true, remaining: rule.limit - 1, resetAt: expiresAt };
  }

  const updated = await RateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 } },
    { new: true },
  ).lean();

  const count = updated?.count ?? 1;
  const resetAt = new Date(new Date(existing.windowStart).getTime() + rule.windowSeconds * 1000);

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
  };
}

/** Throws a 429 with a human message when the limit is exceeded. */
export async function enforceRateLimit(
  name: RateLimitName,
  identifier: string,
  friendlyAction = "do that",
): Promise<void> {
  const result = await checkRateLimit(name, identifier);
  if (!result.allowed) {
    const minutes = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 60000));
    throw new ApiError(
      "RATE_LIMITED",
      `Too many attempts. You can ${friendlyAction} again in about ${
        minutes >= 60 ? `${Math.ceil(minutes / 60)} hour(s)` : `${minutes} minute(s)`
      }.`,
    );
  }
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
