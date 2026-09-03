import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models";
import { loginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { establishSession } from "@/lib/auth/session";
import { ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { clientIp, enforceRateLimit } from "@/lib/api/rateLimit";
import { normalizeRegNo } from "@/lib/domain/regNo";
import { homePathFor } from "@/lib/auth/permissions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await enforceRateLimit("login", clientIp(request), "try signing in");

    const body = await request.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const { identifier, password } = parsed.data;

    await connectDB();

    // Students may sign in with either their e-mail or their registration number.
    const regNo = normalizeRegNo(identifier);
    const query = regNo
      ? { $or: [{ regNo }, { email: identifier.toLowerCase().trim() }] }
      : { email: identifier.toLowerCase().trim() };

    const user = await User.findOne(query).select("+passwordHash").lean();

    // Same message for "no such user" and "wrong password" — no account enumeration.
    const invalid = fail("UNAUTHENTICATED", "Incorrect e-mail/registration number or password.");

    if (!user) return invalid;
    if (!user.isActive) {
      return fail(
        "FORBIDDEN",
        "This account has been disabled. Please contact the hostel administration.",
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return invalid;

    await establishSession({
      sub: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      hostel: user.hostel,
      regNo: user.regNo,
      tv: user.tokenVersion ?? 0,
      mcp: user.mustChangePassword || undefined,
    });

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    return ok({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        hostel: user.hostel,
        regNo: user.regNo,
        mustChangePassword: Boolean(user.mustChangePassword),
      },
      redirectTo: user.mustChangePassword ? "/change-password" : homePathFor(user.role),
    });
  });
}
