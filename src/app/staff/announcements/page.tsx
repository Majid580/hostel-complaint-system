import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Announcement } from "@/models";
import { visibleHostels } from "@/lib/auth/permissions";
import { HOSTELS } from "@/lib/domain/constants";
import { AnnouncementsManager } from "./AnnouncementsManager";

export const metadata = { title: "Notices" };
export const dynamic = "force-dynamic";

export default async function StaffAnnouncementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/student");

  await connectDB();
  const allowed = visibleHostels(user) ?? [...HOSTELS];

  const items = await Announcement.find(
    allowed.length === HOSTELS.length ? {} : { hostels: { $in: allowed } },
  )
    .sort({ pinned: -1, startsAt: -1 })
    .limit(60)
    .lean();

  return (
    <AnnouncementsManager
      allowedHostels={allowed}
      announcements={items.map((a) => ({
        id: String(a._id),
        title: a.title,
        body: a.body,
        hostels: a.hostels,
        audience: a.audience,
        tone: a.tone,
        pinned: a.pinned,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt ? a.endsAt.toISOString() : null,
        createdByName: a.createdByName,
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
