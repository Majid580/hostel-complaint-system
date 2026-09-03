import type { NextRequest } from "next/server";
import { invalidateUserSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { OtpToken, User } from "@/models";
import { resetPasswordSchema } from "@/lib/validation/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { clientIp, enforceRateLimit } from "@/lib/api/rateLimit";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await enforceRateLimit("otp", clientIp(request), "try again");

    const body = await request.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email, isActive: true });
    const invalid = fail("VALIDATION_ERROR", "That code is invalid or has expired.", {
      code: "Invalid or expired code.",
    });
    if (!user) return invalid;

    const token = await OtpToken.findOne({
      userId: user._id,
      purpose: "RESET_PASSWORD",
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!token) return invalid;

    if (token.attempts >= MAX_ATTEMPTS) {
      await OtpToken.deleteOne({ _id: token._id });
      return fail(
        "RATE_LIMITED",
        "Too many incorrect attempts. Please request a new code.",
      );
    }

    const matches = await verifyPassword(parsed.data.code, token.codeHash);
    if (!matches) {
      token.attempts += 1;
      await token.save();
      return invalid;
    }

    user.passwordHash = await hashPassword(parsed.data.newPassword);
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // sign out everywhere
    invalidateUserSession(String(user._id));
    await user.save();

    token.consumedAt = new Date();
    await token.save();
    await OtpToken.deleteMany({ userId: user._id, purpose: "RESET_PASSWORD" });

    return ok({ reset: true, message: "Password updated. You can sign in now." });
  });
}
