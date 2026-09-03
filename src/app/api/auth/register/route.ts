import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models";
import { registerSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { establishSession } from "@/lib/auth/session";
import { created, fail, handleRoute, zodFail } from "@/lib/api/response";
import { clientIp, enforceRateLimit } from "@/lib/api/rateLimit";
import { explainDepartmentError, isAllowedDepartment, parseRegNo } from "@/lib/domain/regNo";
import { getSettings } from "@/lib/services/settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await enforceRateLimit("register", clientIp(request), "register again");

    const body = await request.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const data = parsed.data;
    const settings = await getSettings();

    // Optional institutional-domain restriction (configurable by the coordinator).
    const domain = settings.policy.allowedEmailDomain?.trim().toLowerCase();
    if (domain && !data.email.endsWith(`@${domain}`)) {
      return fail("VALIDATION_ERROR", `Registration is restricted to @${domain} e-mail addresses.`, {
        email: `Use your @${domain} address.`,
      });
    }

    // The regex only validates shape. Reject departments the institute does not
    // issue, so a typo like 2023-CD-580 is caught at sign-up rather than
    // becoming a student nobody can match to a real roll.
    const reg = parseRegNo(data.regNo)!;
    if (!isAllowedDepartment(reg.department, settings.departments)) {
      return fail(
        "VALIDATION_ERROR",
        explainDepartmentError(reg.department, settings.departments),
        { regNo: explainDepartmentError(reg.department, settings.departments) },
      );
    }

    await connectDB();

    const [byRegNo, byEmail] = await Promise.all([
      User.findOne({ regNo: data.regNo }).select("_id").lean(),
      User.findOne({ email: data.email }).select("_id").lean(),
    ]);

    if (byRegNo) {
      return fail("CONFLICT", "An account already exists for that registration number.", {
        regNo: "Already registered. Try signing in, or reset your password.",
      });
    }
    if (byEmail) {
      return fail("CONFLICT", "An account already exists for that e-mail address.", {
        email: "Already registered. Try signing in instead.",
      });
    }

    const parsedReg = reg;
    const passwordHash = await hashPassword(data.password);

    const user = await User.create({
      role: "STUDENT",
      name: data.name,
      email: data.email,
      passwordHash,
      phone: data.phone || undefined,
      regNo: data.regNo,
      department: parsedReg.department,
      session: parsedReg.session,
      roomNo: data.roomNo || undefined,
      hostel: data.hostel,
      isActive: true,
      emailVerified: false,
      mustChangePassword: false,
      tokenVersion: 0,
    });

    await establishSession({
      sub: String(user._id),
      role: "STUDENT",
      name: user.name,
      email: user.email,
      hostel: user.hostel,
      regNo: user.regNo,
      tv: 0,
    });

    return created({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        regNo: user.regNo,
        hostel: user.hostel,
      },
      redirectTo: "/student",
    });
  });
}
