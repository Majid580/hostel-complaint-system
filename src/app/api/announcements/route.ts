import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Announcement } from "@/models";
import { getCurrentUser, requireStaff } from "@/lib/auth/session";
import { created, ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { announcementSchema } from "@/lib/validation/schemas";
import { canAccessHostel } from "@/lib/auth/permissions";
import { notifyManyInApp } from "@/lib/services/notify";
import { User } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    await connectDB();

    const now = new Date();
    const query: Record<string, unknown> = {
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
    };

    if (actor?.role === "STUDENT") {
      query.hostels = actor.hostel;
      query.audience = { $in: ["ALL", "STUDENTS"] };
    } else if (actor?.role === "RT" && actor.hostel) {
      query.hostels = actor.hostel;
    }

    if (request.nextUrl.searchParams.get("includeExpired") === "true" && actor?.role !== "STUDENT") {
      delete query.startsAt;
      delete query.$or;
    }

    const items = await Announcement.find(query as never)
      .sort({ pinned: -1, startsAt: -1 })
      .limit(50)
      .lean();

    return ok({
      announcements: items.map((a) => ({
        id: String(a._id),
        title: a.title,
        body: a.body,
        hostels: a.hostels,
        audience: a.audience,
        tone: a.tone,
        pinned: a.pinned,
        startsAt: a.startsAt,
        endsAt: a.endsAt ?? null,
        createdByName: a.createdByName,
        createdAt: a.createdAt,
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireStaff();

    const body = await request.json().catch(() => ({}));
    const parsed = announcementSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    for (const hostel of parsed.data.hostels) {
      if (!canAccessHostel(actor, hostel)) {
        return fail("FORBIDDEN", "You can only post notices for your own hostel.", {
          hostels: "Outside your hostel.",
        });
      }
    }

    await connectDB();
    const announcement = await Announcement.create({
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : new Date(),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      createdBy: actor.id,
      createdByName: actor.name,
    });

    // Push it to the in-app bell of everyone it applies to.
    const audienceFilter: Record<string, unknown> = { isActive: true };
    if (parsed.data.audience === "STUDENTS") audienceFilter.role = "STUDENT";
    if (parsed.data.audience === "STAFF") audienceFilter.role = { $ne: "STUDENT" };

    const recipients = await User.find({
      ...audienceFilter,
      $or: [{ hostel: { $in: parsed.data.hostels } }, { role: { $in: ["WARDEN", "COORDINATOR"] } }],
    })
      .select("_id")
      .limit(3000)
      .lean();

    await notifyManyInApp(
      recipients.map((u) => u._id),
      {
        type: "ANNOUNCEMENT",
        title: parsed.data.title,
        body: parsed.data.body.slice(0, 200),
        link: "/student/notices",
        tone: parsed.data.tone === "danger" ? "danger" : "info",
      },
    );

    return created({ id: String(announcement._id) });
  });
}
