import bcrypt from "bcryptjs";

/**
 * bcryptjs (pure JS) rather than bcrypt (native) so the free build server never
 * has to compile anything. Cost 10 keeps a serverless hash under ~80 ms.
 */
const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 72, // bcrypt truncates beyond 72 bytes
  description:
    "At least 8 characters, including one letter and one number.",
};

export type PasswordCheck = { ok: boolean; message?: string; score: 0 | 1 | 2 | 3 | 4 };

export function checkPasswordStrength(password: string): PasswordCheck {
  if (!password || password.length < PASSWORD_RULES.minLength) {
    return { ok: false, message: "Password must be at least 8 characters.", score: 0 };
  }
  if (password.length > PASSWORD_RULES.maxLength) {
    return { ok: false, message: "Password must be 72 characters or fewer.", score: 0 };
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return {
      ok: false,
      message: "Password must contain at least one letter and one number.",
      score: 1,
    };
  }

  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const common = ["password", "12345678", "qwerty", "hostel", "letmein", "admin123"];
  if (common.some((c) => password.toLowerCase().includes(c))) {
    return { ok: false, message: "That password is too easy to guess.", score: 0 };
  }

  return { ok: true, score: Math.min(score, 4) as 0 | 1 | 2 | 3 | 4 };
}

/** 6-digit numeric OTP. */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
