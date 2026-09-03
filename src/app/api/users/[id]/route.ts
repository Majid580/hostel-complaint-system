import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models";
import { requireRole, invalidateUserSession } from "@/lib/auth/session";
import { ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { updateUserSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireRole("COORDINATOR");

    const body = await request.json().catch(() => ({}));
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    await connectDB();
    const user = await User.findById(id);
    if (!user) return fail("NOT_FOUND", "Account not found.");

    // A coordinator cannot lock themselves out of the system.
    if (String(user._id) === actor.id && parsed.data.isActive === false) {
      return fail("CONFLICT", "You cannot deactivate your own account.");
    }
    if (String(user._id) === actor.id && parsed.data.role && parsed.data.role !== "COORDINATOR") {
      return fail("CONFLICT", "You cannot change your own role.");
    }

    if (parsed.data.role === "RT" && (parsed.data.hostel ?? user.hostel) == null) {
      return fail("VALIDATION_ERROR", "A Resident Tutor must be assigned to a hostel.", {
        hostel: "Required for an RT.",
      });
    }

    const deactivating = parsed.data.isActive === false && user.isActive;
    Object.assign(user, parsed.data);

    // Deactivating must end the person's live sessions immediately.
    if (deactivating) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    invalidateUserSession(String(user._id));

    await user.save();

    return ok({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        hostel: user.hostel ?? null,
        isActive: user.isActive,
      },
    });
  });
}
