import { redirect } from "next/navigation";
import { Building2, Info } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint } from "@/models";
import { Alert, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import {
  CategoryBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/shared/badges";
import { UpvoteButton } from "@/components/complaint/StudentActions";
import { HOSTEL_META, OPEN_STATUSES } from "@/lib/domain/constants";
import { maskRegNo } from "@/lib/domain/regNo";
import { formatAge } from "@/lib/domain/priority";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Hostel feed" };
export const dynamic = "force-dynamic";

/**
 * The shared view of what is currently broken in the hostel.
 *
 * Two purposes: residents can see that a problem is already reported instead of
 * filing a duplicate, and they can mark "this affects me too", which raises the
 * complaint's priority. Descriptions and attachments are deliberately not shown
 * — only enough to recognise the problem.
 */
export default async function HostelFeedPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") redirect("/login");
  if (!user.hostel) redirect("/student");

  await connectDB();
  const complaints = await Complaint.find({
    hostel: user.hostel,
    status: { $in: [...OPEN_STATUSES] },
    deletedAt: null,
  })
    .sort({ priorityScore: -1, createdAt: 1 })
    .limit(40)
    .select(
      "code title category severity status createdAt location upvotes upvoteCount isAnonymous student.name student.regNo student.userId",
    )
    .lean();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">
          What is being worked on in {HOSTEL_META[user.hostel].label}
        </h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground text-pretty">
          Open complaints from your hostel. If one of these affects you too, say so — complaints
          affecting more residents move up the queue.
        </p>
      </header>

      <Alert tone="info" icon={<Info className="size-4" />}>
        Descriptions, photos and voice notes stay private to the person who filed them and to hostel
        staff. Only enough is shown here to recognise a problem you may share.
      </Alert>

      {complaints.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="Nothing is currently open in your hostel"
          description="Every reported problem has been closed. If something is broken, file it."
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const isMine = String(c.student.userId) === user.id;
            const hasUpvoted = (c.upvotes ?? []).some((id) => String(id) === user.id);
            // Server component: read once per request, no client render to differ.
            // eslint-disable-next-line react-hooks/purity
            const ageHours = (Date.now() - new Date(c.createdAt).getTime()) / 3_600_000;

            return (
              <Card key={String(c._id)}>
                <CardContent className="p-4 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {c.code}
                      </p>
                      <h2 className="mt-0.5 font-semibold leading-snug">{c.title}</h2>
                    </div>
                    <StatusBadge status={c.status} short />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <SeverityBadge severity={c.severity} />
                    <CategoryBadge category={c.category} />
                  </div>

                  <p className="mt-2.5 text-xs text-muted-foreground">
                    {c.isAnonymous
                      ? `Anonymous resident (${maskRegNo(c.student.regNo)})`
                      : `${c.student.name} (${c.student.regNo})`}
                    {c.location ? ` · ${c.location}` : ""} · reported {relativeTime(c.createdAt)} ·
                    waiting {formatAge(ageHours)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {c.upvoteCount > 0
                        ? `${c.upvoteCount} resident${c.upvoteCount === 1 ? "" : "s"} also affected`
                        : "No one else has reported this yet"}
                    </p>
                    {isMine ? (
                      <span className="text-xs font-medium text-primary">Your complaint</span>
                    ) : (
                      <UpvoteButton
                        complaintId={String(c._id)}
                        initialCount={c.upvoteCount}
                        initialUpvoted={hasUpvoted}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
