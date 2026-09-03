import { redirect } from "next/navigation";
import { Megaphone, Pin } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Announcement } from "@/models";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { HOSTEL_META } from "@/lib/domain/constants";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Notices" };
export const dynamic = "force-dynamic";

export default async function StudentNoticesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") redirect("/login");

  await connectDB();
  const now = new Date();
  const notices = await Announcement.find({
    hostels: user.hostel,
    audience: { $in: ["ALL", "STUDENTS"] },
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
  })
    .sort({ pinned: -1, startsAt: -1 })
    .limit(40)
    .lean();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">Notices</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Announcements from the Resident Tutor and the Hostel Warden for{" "}
          {user.hostel ? HOSTEL_META[user.hostel].label : "your hostel"}.
        </p>
      </header>

      {notices.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="No notices right now"
          description="Planned maintenance, water or power interruptions and mess changes will appear here."
        />
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card
              key={String(notice._id)}
              className={
                notice.tone === "danger"
                  ? "border-destructive/40"
                  : notice.tone === "warning"
                    ? "border-warning/40"
                    : undefined
              }
            >
              <CardContent className="p-5 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{notice.title}</h2>
                  {notice.pinned && (
                    <Badge tone="primary">
                      <Pin className="size-3" />
                      Pinned
                    </Badge>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{notice.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {notice.createdByName} · {relativeTime(notice.startsAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
