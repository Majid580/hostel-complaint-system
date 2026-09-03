import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { OtpToken, User } from "@/models";
import { forgotPasswordSchema } from "@/lib/validation/schemas";
import { generateOtp, hashPassword } from "@/lib/auth/password";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { clientIp, enforceRateLimit } from "@/lib/api/rateLimit";
import { queueMail } from "@/lib/services/notify";
import { otpEmail } from "@/lib/mail/templates";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await enforceRateLimit("otp", clientIp(request), "request another code");

    const body = await request.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email, isActive: true })
      .select("_id name email")
      .lean();

    // Always answer the same way — never reveal whether an account exists.
    const genericResponse = ok({
      sent: true,
      message: "If that e-mail is registered, a 6-digit code is on its way.",
    });

    if (!user) return genericResponse;

    const code = generateOtp();
    await OtpToken.deleteMany({ userId: user._id, purpose: "RESET_PASSWORD" });
    await OtpToken.create({
      userId: user._id,
      purpose: "RESET_PASSWORD",
      codeHash: await hashPassword(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    });

    await queueMail([user.email], otpEmail(user.name, code, "RESET_PASSWORD"));

    return genericResponse;
  });
}
