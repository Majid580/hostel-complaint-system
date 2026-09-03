import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models";
import { requireRole } from "@/lib/auth/session";
import { created, ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { createStaffSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { queueMail } from "@/lib/services/notify";
import { staffWelcome } from "@/lib/mail/templates";
import { ROLE_META } from "@/lib/domain/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Coordinator-only: the RT / Warden / Coordinator account list. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await requireRole("COORDINATOR");
    await connectDB();

    const role = request.nextUrl.searchParams.get("role");
    const q = request.nextUrl.searchParams.get("q")?.trim();

    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    else query.role = { $in: ["RT", "WARDEN", "COORDINATOR"] };

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { email: rx }, { regNo: rx }];
    }

    const users = await User.find(query as never)
      .sort({ role: 1, name: 1 })
      .limit(200)
      .lean();

    return ok({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        role: u.role,
        hostel: u.hostel ?? null,
        regNo: u.regNo ?? null,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        lastLoginAt: u.lastLoginAt ?? null,
        createdAt: u.createdAt,
      })),
    });
  });
}

/** Creates a staff account and e-mails a temporary password. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireRole("COORDINATOR");

    const body = await request.json().catch(() => ({}));
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;

    await connectDB();

    const existing = await User.findOne({ email: data.email }).select("_id").lean();
    if (existing) {
      return fail("CONFLICT", "An account with that e-mail already exists.", {
        email: "Already in use.",
      });
    }

    // One active RT per hostel keeps routing unambiguous.
    if (data.role === "RT" && data.hostel) {
      const currentRt = await User.findOne({ role: "RT", hostel: data.hostel, isActive: true })
        .select("name")
        .lean();
      if (currentRt) {
        return fail(
          "CONFLICT",
          `${currentRt.name} is already the active Resident Tutor for that hostel. Deactivate them first.`,
          { hostel: "This hostel already has an active RT." },
        );
      }
    }

    const tempPassword =
      data.password ?? `Hcms-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const user = await User.create({
      role: data.role,
      name: data.name,
      email: data.email,
      phone: data.phone || undefined,
      hostel: data.role === "RT" ? data.hostel : undefined,
      passwordHash: await hashPassword(tempPassword),
      isActive: true,
      emailVerified: true,
      mustChangePassword: true,
      tokenVersion: 0,
    });

    await queueMail(
      [user.email],
      staffWelcome(user.name, ROLE_META[user.role].label, user.email, tempPassword),
    );

    return created({
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
      // Shown once to the coordinator in case the e-mail does not arrive.
      temporaryPassword: tempPassword,
      createdBy: actor.name,
    });
  });
}
