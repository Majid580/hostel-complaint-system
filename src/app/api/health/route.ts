import { pingDB } from "@/lib/db/mongoose";
import { mailConfigured } from "@/lib/mail/transport";
import { env } from "@/lib/config/env";
import { ok } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await pingDB();
  return ok({
    status: db ? "healthy" : "degraded",
    database: db ? "up" : "down",
    mail: mailConfigured() ? "configured" : "not-configured",
    media: env.cloudinaryConfigured ? "configured" : "not-configured",
    time: new Date().toISOString(),
  });
}
