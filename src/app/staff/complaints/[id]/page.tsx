import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  PauseCircle,
  ShieldAlert,
  Star,
  ThumbsUp,
  User as UserIcon,
  Wrench,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getComplaintDetail } from "@/lib/services/getComplaintDetail";
import { getSettings } from "@/lib/services/settings";
import { Alert, Badge, Card, CardContent, Separator } from "@/components/ui/primitives";
import {
  CategoryBadge,
  EscalationBadge,
  HostelBadge,
  PriorityBadge,
  SeverityBadge,
  SlaBadge,
  StatusBadge,
} from "@/components/shared/badges";
import { StatusStepper } from "@/components/complaint/StatusStepper";
import { Timeline } from "@/components/complaint/Timeline";
import { ImageGallery } from "@/components/complaint/ImageGallery";
import { AudioPlayer } from "@/components/media/AudioRecorder";
import { CommentBox } from "@/components/complaint/CommentBox";
import { StaffActions, ReassignButton } from "@/components/staff/StaffActions";
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

export default async function StaffComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect(`/student/complaints/${id}`);

  const [detail, settings] = await Promise.all([getComplaintDetail(id, user), getSettings()]);
  if (!detail) notFound();

  const { complaint: c, timeline } = detail;

  return (
    <div className="space-y-5">
      <Link
        href="/staff/complaints"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to the queue
      </Link>

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
          <PriorityBadge score={c.priorityScore} />
          <EscalationBadge level={c.escalationLevel} disputed={c.isDisputed} />
        </div>
      </header>

      {/* ---------- Alerts that demand attention first ---------- */}
      {c.isDisputed && (
        <Alert
          tone="danger"
          title="The student disputes this resolution"
          icon={<ShieldAlert className="size-4" />}
        >
          This complaint was marked resolved, and more than 24 hours later the student reported that
          the work was never done. It has been reopened and the Hostel Warden and Campus Coordinator
          have been notified. This is recorded against whoever marked it resolved.
        </Alert>
      )}

      {c.escalationLevel > 0 && !c.isDisputed && (
        <Alert tone="warning" title={`Escalated to the ${c.escalationLevel === 1 ? "Hostel Warden" : "Campus Coordinator"}`}>
          This complaint waited too long without action. It stays at the top of the queue until it is
          closed.
        </Alert>
      )}

      {c.sla.resolveBreached && (
        <Alert tone="warning" title="Past its resolution deadline">
          The deadline was {formatDateTime(c.sla.resolveDueAt)} ({relativeTime(c.sla.resolveDueAt)}).
        </Alert>
      )}

      <Card>
        <CardContent className="p-5 pt-5">
          <StatusStepper status={c.status} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {/* ---------- The complaint ---------- */}
          <Card>
            <CardContent className="space-y-4 p-5 pt-5">
              <div>
                <h2 className="mb-1.5 font-semibold">What the student reported</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p>
              </div>

              {c.location && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {c.location}
                </p>
              )}

              {c.images.length > 0 && <ImageGallery images={c.images} label="Photos" />}
              {c.audio && <AudioPlayer url={c.audio.url} duration={c.audio.duration} />}
            </CardContent>
          </Card>

          {/* ---------- Resolution / rejection / hold ---------- */}
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

          {c.rejection && (
            <Alert
              tone="danger"
              title={`Rejected by ${c.rejection.rejectedByName}`}
              icon={<XCircle className="size-4" />}
            >
              {c.rejection.reason}
              <span className="mt-1 block text-xs">{formatDateTime(c.rejection.rejectedAt)}</span>
            </Alert>
          )}

          {c.resolution && (
            <Card className="border-success/40">
              <CardContent className="space-y-3 p-5 pt-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 text-success" />
                  Resolution
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.resolution.note}</p>
                <p className="text-xs text-muted-foreground">
                  {c.resolution.resolvedByName} ({c.resolution.resolvedByRole}) ·{" "}
                  {formatDateTime(c.resolution.resolvedAt)}
                </p>
                {c.resolution.proofImages.length > 0 && (
                  <ImageGallery images={c.resolution.proofImages} label="Proof photos" />
                )}
              </CardContent>
            </Card>
          )}

          {c.verification && (
            <Alert tone="success" title="Closed">
              {c.verification.method === "AUTO"
                ? "Closed automatically after 72 hours with no student response."
                : c.verification.method === "STUDENT"
                  ? "The student confirmed the problem was fixed."
                  : "Closed by staff."}
              {c.verification.rating && (
                <span className="mt-1 flex items-center gap-1">
                  <Star className="size-3.5 fill-warning text-warning" />
                  Rated {c.verification.rating}/5
                </span>
              )}
              {c.verification.feedback && (
                <span className="mt-1 block italic">“{c.verification.feedback}”</span>
              )}
            </Alert>
          )}

          {/* ---------- Timeline ---------- */}
          <Card>
            <CardContent className="p-5 pt-5">
              <h2 className="mb-4 font-semibold">History</h2>
              <Timeline entries={timeline} />
              <Separator className="my-5" />
              <h3 className="mb-2.5 text-sm font-semibold">Add a comment or internal note</h3>
              <CommentBox complaintId={c.id} allowInternal />
            </CardContent>
          </Card>
        </div>

        {/* ---------- Sidebar ---------- */}
        <div className="space-y-5">
          <StaffActions
            complaintId={c.id}
            hostel={c.hostel}
            actions={(c.actions ?? []) as never}
            currentSeverity={c.severity}
            requireProof={settings.policy.requireProofOnResolve}
          />

          {/* ---------- Reporter ---------- */}
          <Card>
            <CardContent className="space-y-2.5 p-5 pt-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <UserIcon className="size-4" />
                Reported by
              </h2>
              <div>
                <p className="text-sm font-medium">{c.student.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{c.student.regNo}</p>
              </div>
              {c.student.roomNo && (
                <p className="text-sm">
                  Room <span className="font-medium">{c.student.roomNo}</span>
                </p>
              )}
              {c.student.email && (
                <a
                  href={`mailto:${c.student.email}`}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Mail className="size-3.5" />
                  {c.student.email}
                </a>
              )}
              {c.student.phone && (
                <a
                  href={`tel:${c.student.phone}`}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Phone className="size-3.5" />
                  {c.student.phone}
                </a>
              )}
              {c.isAnonymous && (
                <Badge tone="neutral">Filed anonymously — hidden from other students</Badge>
              )}
            </CardContent>
          </Card>

          {/* ---------- Assignment ---------- */}
          <Card>
            <CardContent className="space-y-2.5 p-5 pt-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Wrench className="size-4" />
                Assignment
              </h2>

              {c.assignment ? (
                <>
                  <p className="text-sm font-medium">{c.assignment.workerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {TRADE_LABEL[c.assignment.trade]} · assigned by {c.assignment.assignedByName}{" "}
                    {relativeTime(c.assignment.assignedAt)}
                  </p>
                  {c.assignment.workerPhone && (
                    <a
                      href={`tel:${c.assignment.workerPhone}`}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Phone className="size-3.5" />
                      {c.assignment.workerPhone}
                    </a>
                  )}
                  {c.assignment.expectedCompletionAt && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      Expected by {formatDateTime(c.assignment.expectedCompletionAt)}
                    </p>
                  )}
                  {c.assignment.remarks && (
                    <p className="rounded-lg bg-muted/50 p-2 text-xs">{c.assignment.remarks}</p>
                  )}
                  <ReassignButton complaintId={c.id} hostel={c.hostel} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No worker assigned yet. Use <strong>Assign worker</strong> above.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ---------- SLA ---------- */}
          <Card>
            <CardContent className="space-y-3 p-5 pt-5">
              <h2 className="font-semibold">Clocks</h2>
              <dl className="space-y-2.5 text-sm">
                <Row label="Filed">
                  {relativeTime(c.createdAt)}
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                  </span>
                </Row>
                <Row label="Waiting">{formatAge(c.ageHours)}</Row>
                <Row label="Acknowledge">
                  {c.sla.firstResponseAt ? (
                    <>
                      {relativeTime(c.sla.firstResponseAt)}
                      {c.sla.ackBreached && (
                        <span className="block text-xs font-medium text-destructive">Late</span>
                      )}
                    </>
                  ) : (
                    <SlaBadge dueAt={c.sla.ackDueAt} />
                  )}
                </Row>
                <Row label="Resolve by">
                  <SlaBadge dueAt={c.sla.resolveDueAt} stopped={!STATUS_META[c.status].isOpen} />
                </Row>
                {c.reopenCount > 0 && (
                  <Row label="Reopened">
                    <span className="font-medium text-destructive">{c.reopenCount}×</span>
                  </Row>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* ---------- Why it ranks here ---------- */}
          <Card>
            <CardContent className="p-5 pt-5">
              <h2 className="font-semibold">Why this priority</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Score {c.priorityScore.toFixed(0)} — the queue is sorted by this.
              </p>
              <ul className="mt-2.5 space-y-1">
                {c.priorityReasons.map((reason) => (
                  <li key={reason} className="flex items-center gap-1.5 text-xs">
                    <span className="size-1 shrink-0 rounded-full bg-primary" />
                    {reason}
                  </li>
                ))}
              </ul>
              {c.upvoteCount > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ThumbsUp className="size-3.5" />
                  {c.upvoteCount} other resident{c.upvoteCount === 1 ? "" : "s"} affected
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
