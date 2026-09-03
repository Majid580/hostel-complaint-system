import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { establishSession, requireAuth, invalidateUserSession } from "@/lib/auth/session";
import { ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { homePathFor } from "@/lib/auth/permissions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireAuth();

    const body = await request.json().catch(() => ({}));
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    await connectDB();
    const user = await User.findById(actor.id).select("+passwordHash");
    if (!user) return fail("NOT_FOUND", "Account not found.");

    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return fail("VALIDATION_ERROR", "Your current password is incorrect.", {
        currentPassword: "Incorrect password.",
      });
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return fail("VALIDATION_ERROR", "Choose a password you have not used before.", {
        newPassword: "The new password must be different.",
      });
    }

    user.passwordHash = await hashPassword(parsed.data.newPassword);
    user.mustChangePassword = false;
    // Invalidate every other session that was issued with the old password.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    invalidateUserSession(String(user._id));
    await user.save();

    await establishSession({
      sub: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      hostel: user.hostel,
      regNo: user.regNo,
      tv: user.tokenVersion,
    });

    return ok({ changed: true, redirectTo: homePathFor(user.role) });
  });
}
