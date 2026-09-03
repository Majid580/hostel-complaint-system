import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models";
import { requireAuth } from "@/lib/auth/session";
import { ok, handleRoute } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireAuth();
    await connectDB();

    // The header bell polls with countOnly, which must stay a single query.
    if (request.nextUrl.searchParams.get("countOnly") === "true") {
      const unread = await Notification.countDocuments({ userId: actor.id, isRead: false });
      return ok({ unread });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 30), 100);

    // Independent queries: run them together rather than paying two round trips.
    const [unread, items] = await Promise.all([
      Notification.countDocuments({ userId: actor.id, isRead: false }),
      Notification.find({ userId: actor.id }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]);

    return ok({
      unread,
      notifications: items.map((n) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link ?? null,
        tone: n.tone,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  });
}

/** Marks everything (or one item) as read. */
export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireAuth();
    const body = (await request.json().catch(() => ({}))) as { id?: string };

    await connectDB();
    const filter: Record<string, unknown> = { userId: actor.id, isRead: false };
    if (body.id && /^[a-f\d]{24}$/i.test(body.id)) filter._id = body.id;

    const result = await Notification.updateMany(filter, { $set: { isRead: true } });
    return ok({ updated: result.modifiedCount });
  });
}
