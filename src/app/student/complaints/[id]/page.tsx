import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  PauseCircle,
  Timer,
  Wrench,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getComplaintDetail } from "@/lib/services/getComplaintDetail";
import { Alert, Card, CardContent, Separator } from "@/components/ui/primitives";
import {
  CategoryBadge,
  EscalationBadge,
  HostelBadge,
  SeverityBadge,
  SlaBadge,
  StatusBadge,
} from "@/components/shared/badges";
import { StatusStepper } from "@/components/complaint/StatusStepper";
import { Timeline } from "@/components/complaint/Timeline";
import { ImageGallery } from "@/components/complaint/ImageGallery";
import { AudioPlayer } from "@/components/media/AudioRecorder";
import { StudentActions } from "@/components/complaint/StudentActions";
import { CommentBox } from "@/components/complaint/CommentBox";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { formatAge } from "@/lib/domain/priority";
import { STATUS_META, TRADE_LABEL } from "@/lib/domain/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return { title: "Complaint" };
  const detail = await getComplaintDetail(id, user);
  return { title: detail ? `${detail.complaint.code} — ${detail.complaint.title}` : "Complaint" };
}

export default async function StudentComplaintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect(`/staff/complaints/${id}`);

  const detail = await getComplaintDetail(id, user);
  if (!detail) notFound();

  const { complaint: c, timeline } = detail;

  return (
    <div className="space-y-5">
      <Link
        href="/student"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to my complaints
      </Link>

      {/* ---------- Header ---------- */}
      <header>
        <span className="job-tag">{c.code}</span>
        <h1 className="mt-2 font-display text-[25px] font-semibold leading-[1.15] text-balance sm:text-3xl">
          {c.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={c.status} />
          <SeverityBadge severity={c.severity} />
          <CategoryBadge category={c.category} />
          <HostelBadge hostel={c.hostel} />
          <EscalationBadge level={c.escalationLevel} disputed={c.isDisputed} />
        </div>
      </header>

      <Card>
        <CardContent className="p-5 pt-5">
          <StatusStepper status={c.status} />
          <p className="mt-4 text-sm text-muted-foreground">{STATUS_META[c.status].description}</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {/* ---------- Rejection / hold notices ---------- */}
          {c.rejection && (
            <Alert
              tone="danger"
              title={`Rejected by ${c.rejection.rejectedByName}`}
              icon={<XCircle className="size-4" />}
            >
              {c.rejection.reason}
              <span className="mt-1 block text-xs">
                {formatDateTime(c.rejection.rejectedAt)} — if you disagree, ask the Hostel Warden to
                review it.
              </span>
            </Alert>
          )}

          {c.onHold && (
            <Alert tone="warning" title="On hold" icon={<PauseCircle className="size-4" />}>
              {c.onHold.reason}
              {c.onHold.until && (
                <span className="mt-1 block text-xs">
                  Expected to resume {formatDateTime(c.onHold.until)}
                </span>
              )}
            </Alert>
          )}

          {/* ---------- The complaint itself ---------- */}
          <Card>
            <CardContent className="space-y-4 p-5 pt-5">
              <div>
                <h2 className="mb-1.5 font-semibold">What you reported</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p>
              </div>

              {c.location && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {c.location}
                </p>
              )}

              {c.images.length > 0 && <ImageGallery images={c.images} label="Your photos" />}

              {c.audio && <AudioPlayer url={c.audio.url} duration={c.audio.duration} />}
            </CardContent>
          </Card>

          {/* ---------- Resolution ---------- */}
          {c.resolution && (
            <Card className="border-success/40">
              <CardContent className="space-y-3 p-5 pt-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 text-success" />
                  What staff say was done
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.resolution.note}</p>
                <p className="text-xs text-muted-foreground">
                  Marked resolved by {c.resolution.resolvedByName} ·{" "}
                  {formatDateTime(c.resolution.resolvedAt)}
                </p>
                {c.resolution.proofImages.length > 0 && (
                  <ImageGallery images={c.resolution.proofImages} label="Proof of the work" />
                )}
              </CardContent>
            </Card>
          )}

          {c.verification && (
            <Alert tone="success" title="Closed">
              {c.verification.method === "AUTO"
                ? "Closed automatically after 72 hours with no response."
                : "You confirmed this problem was fixed."}
              {c.verification.rating ? ` You rated the repair ${c.verification.rating}/5.` : ""}
            </Alert>
          )}

          {/* ---------- Timeline ---------- */}
          <Card>
            <CardContent className="p-5 pt-5">
              <h2 className="mb-4 font-semibold">History</h2>
              <Timeline entries={timeline} />
              <Separator className="my-5" />
              <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="size-4" />
                Add a comment
              </h3>
              <CommentBox complaintId={c.id} allowInternal={false} />
            </CardContent>
          </Card>
        </div>

        {/* ---------- Sidebar ---------- */}
        <div className="space-y-5">
          <StudentActions
            complaint={{
              id: c.id,
              code: c.code,
              status: c.status,
              isDisputed: c.isDisputed,
              escalationLevel: c.escalationLevel,
              hasUpvoted: c.hasUpvoted,
              upvoteCount: c.upvoteCount,
              escalation: {
                canEscalate: c.escalation.canEscalate,
                escalateReason: c.escalation.escalateReason,
                escalateAvailableAt: c.escalation.escalateAvailableAt
                  ? new Date(c.escalation.escalateAvailableAt).toISOString()
                  : null,
                canFlagFalseResolution: c.escalation.canFlagFalseResolution,
                flagReason: c.escalation.flagReason,
                flagAvailableAt: c.escalation.flagAvailableAt
                  ? new Date(c.escalation.flagAvailableAt).toISOString()
                  : null,
              },
            }}
          />

          {/* ---------- Assignment ---------- */}
          {c.assignment && (
            <Card>
              <CardContent className="space-y-2 p-5 pt-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Wrench className="size-4" />
                  Assigned worker
                </h2>
                <p className="text-sm font-medium">{c.assignment.workerName}</p>
                <p className="text-xs text-muted-foreground">
                  {TRADE_LABEL[c.assignment.trade]} · assigned by {c.assignment.assignedByName}
                </p>
                {c.assignment.expectedCompletionAt && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    Expected by {formatDateTime(c.assignment.expectedCompletionAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ---------- Timings ---------- */}
          <Card>
            <CardContent className="space-y-3 p-5 pt-5">
              <h2 className="font-semibold">Timing</h2>

              <dl className="space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5" />
                    Filed
                  </dt>
                  <dd className="text-right">
                    {relativeTime(c.createdAt)}
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="size-3.5" />
                    Waiting
                  </dt>
                  <dd className="font-medium">{formatAge(c.ageHours)}</dd>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <dt className="text-muted-foreground">First response</dt>
                  <dd className="text-right">
                    {c.sla.firstResponseAt ? (
                      <>
                        {relativeTime(c.sla.firstResponseAt)}
                        {c.sla.ackBreached && (
                          <span className="block text-xs font-medium text-destructive">
                            Missed the deadline
                          </span>
                        )}
                      </>
                    ) : (
                      <SlaBadge dueAt={c.sla.ackDueAt} label="Due" />
                    )}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <dt className="text-muted-foreground">Resolution target</dt>
                  <dd>
                    <SlaBadge
                      dueAt={c.sla.resolveDueAt}
                      stopped={!STATUS_META[c.status].isOpen}
                      label="Due"
                    />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {c.upvoteCount > 0 && (
            <Card>
              <CardContent className="p-5 pt-5">
                <p className="text-sm">
                  <span className="font-semibold">{c.upvoteCount}</span> other resident
                  {c.upvoteCount === 1 ? "" : "s"} reported being affected by this. That raises its
                  priority.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
