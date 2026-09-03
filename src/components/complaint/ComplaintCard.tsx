import Link from "next/link";
import {
  ArrowUpCircle,
  Camera,
  Clock,
  MapPin,
  Mic,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/primitives";
import {
  CategoryBadge,
  EscalationBadge,
  HostelBadge,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/shared/badges";
import { cn, relativeTime, truncate } from "@/lib/utils";
import { formatAge } from "@/lib/domain/priority";
import type { ComplaintRow } from "@/lib/services/listComplaints";

export function ComplaintCard({
  complaint,
  href,
  showHostel = false,
  showReporter = false,
}: {
  complaint: ComplaintRow;
  href: string;
  showHostel?: boolean;
  showReporter?: boolean;
}) {
  // Server component: the clock is read once per request, so there is no client
  // render for this value to disagree with.
  // eslint-disable-next-line react-hooks/purity
  const ageHours = (Date.now() - new Date(complaint.createdAt).getTime()) / 3_600_000;
  const overdue = complaint.sla.resolveBreached;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-colors hover:border-primary/50",
        overdue && "border-destructive/40",
        complaint.isDisputed && "border-destructive/60",
      )}
    >
      {/* Priority rail: the higher the score, the more of the edge is coloured. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          complaint.escalationLevel > 0 || complaint.isDisputed
            ? "bg-destructive"
            : overdue
              ? "bg-warning"
              : complaint.severity === "CRITICAL"
                ? "bg-destructive/70"
                : "bg-transparent",
        )}
      />

      <Link href={href} className="block p-3.5 pl-4 focus-visible:outline-none sm:p-4 sm:pl-5">
        <div className="flex items-center justify-between gap-2">
          <span className="job-tag">{complaint.code}</span>
          <StatusBadge status={complaint.status} short />
        </div>

        <h3 className="mt-2 font-display text-[16px] font-semibold leading-snug group-hover:text-primary sm:text-[17px]">
          {truncate(complaint.title, 92)}
        </h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={complaint.severity} />
          <CategoryBadge category={complaint.category} />
          {showHostel && <HostelBadge hostel={complaint.hostel} />}
          <PriorityBadge score={complaint.priorityScore} />
          <EscalationBadge level={complaint.escalationLevel} disputed={complaint.isDisputed} />
        </div>

        <dl className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11.5px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <dt className="sr-only">Age</dt>
            <dd>
              {formatAge(ageHours)} old · {relativeTime(complaint.createdAt)}
            </dd>
          </div>

          {complaint.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              <dt className="sr-only">Location</dt>
              <dd>{truncate(complaint.location, 36)}</dd>
            </div>
          )}

          {complaint.assignedTo && (
            <div className="flex items-center gap-1.5">
              <Wrench className="size-3.5" />
              <dt className="sr-only">Assigned to</dt>
              <dd>{complaint.assignedTo}</dd>
            </div>
          )}

          {showReporter && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Reported by</dt>
              <dd>
                {complaint.student.name}
                <span className="ml-1 font-mono">({complaint.student.regNo})</span>
                {complaint.student.roomNo ? ` · Room ${complaint.student.roomNo}` : ""}
              </dd>
            </div>
          )}

          {complaint.upvoteCount > 0 && (
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="size-3.5" />
              <dt className="sr-only">Also affected</dt>
              <dd>
                {complaint.upvoteCount} other{complaint.upvoteCount === 1 ? "" : "s"} affected
              </dd>
            </div>
          )}

          {complaint.imageCount > 0 && (
            <div className="flex items-center gap-1">
              <Camera className="size-3.5" />
              <dd>{complaint.imageCount}</dd>
            </div>
          )}
          {complaint.hasAudio && (
            <div className="flex items-center gap-1">
              <Mic className="size-3.5" />
              <dd className="sr-only">Has a voice note</dd>
            </div>
          )}
        </dl>

        {overdue && (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
            <ArrowUpCircle className="size-3.5" />
            Past its resolution deadline
          </p>
        )}
      </Link>
    </Card>
  );
}
