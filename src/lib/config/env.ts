/**
 * Centralised, lazily-validated environment access.
 *
 * Why lazy: `next build` evaluates modules without a full runtime environment.
 * Throwing at import time would break the build on Vercel before env vars are
 * injected. Instead every getter validates on first *use* and fails loudly with
 * an actionable message.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in (see docs/DEPLOYMENT.md).`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

function bool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export type MailProvider = "console" | "smtp" | "resend";

export const env = {
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
  get isDev() {
    return process.env.NODE_ENV !== "production";
  },

  // --- core ---------------------------------------------------------------
  get mongodbUri() {
    return required("MONGODB_URI");
  },
  get jwtSecret() {
    return required("JWT_SECRET");
  },
  /**
   * The base every e-mail link is built from.
   *
   * `NEXT_PUBLIC_APP_URL` is inlined at BUILD time, so forgetting it — or
   * setting it without redeploying — silently produced e-mails pointing at
   * localhost, which is useless to the RT who received them and gives no clue
   * why. Vercel's own system variables are available at runtime, so fall back
   * to the project's production domain before ever reaching for localhost.
   *
   * VERCEL_PROJECT_PRODUCTION_URL is the stable production domain;
   * VERCEL_URL is the per-deployment one and is only a last resort, since a
   * link to a specific preview deployment outlives its usefulness quickly.
   */
  get appUrl() {
    const explicit = optional("NEXT_PUBLIC_APP_URL");
    if (explicit) return explicit.replace(/\/+$/, "");

    const vercelDomain =
      optional("VERCEL_PROJECT_PRODUCTION_URL") || optional("VERCEL_URL");
    if (vercelDomain) {
      return `https://${vercelDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
    }

    return "http://localhost:3000";
  },

  // --- media --------------------------------------------------------------
  get cloudinary() {
    return {
      cloudName: optional("CLOUDINARY_CLOUD_NAME"),
      apiKey: optional("CLOUDINARY_API_KEY"),
      apiSecret: optional("CLOUDINARY_API_SECRET"),
      publicCloudName: optional("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
    };
  },
  get cloudinaryConfigured() {
    const c = this.cloudinary;
    return Boolean(c.cloudName && c.apiKey && c.apiSecret);
  },

  // --- mail ---------------------------------------------------------------
  get mailProvider(): MailProvider {
    const p = optional("MAIL_PROVIDER", "console").toLowerCase();
    return (["console", "smtp", "resend"] as const).includes(p as MailProvider)
      ? (p as MailProvider)
      : "console";
  },
  get mailFrom() {
    return optional("MAIL_FROM", "HCMS <no-reply@localhost>");
  },
  get smtp() {
    return {
      host: optional("SMTP_HOST"),
      port: Number(optional("SMTP_PORT", "587")),
      secure: bool("SMTP_SECURE", false),
      user: optional("SMTP_USER"),
      pass: optional("SMTP_PASS"),
    };
  },
  get resendApiKey() {
    return optional("RESEND_API_KEY");
  },

  // --- cron ---------------------------------------------------------------
  get cronSecret() {
    return optional("CRON_SECRET");
  },

  // --- seeding ------------------------------------------------------------
  get seedPassword() {
    return optional("SEED_DEFAULT_PASSWORD", "Hcms@2026");
  },
  get seedDemoData() {
    return bool("SEED_DEMO_DATA", true);
  },

  // --- branding -----------------------------------------------------------
  get instituteName() {
    return optional("NEXT_PUBLIC_INSTITUTE_NAME", "Your Institute");
  },
  get appName() {
    return optional("NEXT_PUBLIC_APP_NAME", "Hostel Complaint Portal");
  },
  /** Short form for tight mobile headers; falls back to the full name. */
  get instituteShort() {
    return optional("NEXT_PUBLIC_INSTITUTE_SHORT", "") || this.instituteName;
  },
};

/** Public (client-safe) values. Never expose secrets here. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
  instituteName: process.env.NEXT_PUBLIC_INSTITUTE_NAME ?? "Your Institute",
  instituteShort:
    process.env.NEXT_PUBLIC_INSTITUTE_SHORT ||
    process.env.NEXT_PUBLIC_INSTITUTE_NAME ||
    "Your Institute",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Hostel Complaint Portal",
};
