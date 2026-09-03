import {
  CATEGORY_META,
  HOSTEL_META,
  SEVERITY_META,
  STATUS_META,
  type Category,
  type ComplaintStatus,
  type Hostel,
  type Severity,
} from "@/lib/domain/constants";
import { PRIORITY_BAND_META, priorityBand } from "@/lib/domain/priority";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  AlertOctagon,
  ArrowUpCircle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";

const STATUS_ICON: Record<ComplaintStatus, typeof Circle> = {
  SUBMITTED: Circle,
  ACKNOWLEDGED: UserCheck,
  ASSIGNED: ArrowUpCircle,
  IN_PROGRESS: Loader2,
  ON_HOLD: PauseCircle,
  RESOLVED: CheckCircle2,
  VERIFIED_CLOSED: ShieldCheck,
  REOPENED: RotateCcw,
  REJECTED: XCircle,
};

export function StatusBadge({
  status,
  className,
  short,
}: {
  status: ComplaintStatus;
  className?: string;
  short?: boolean;
}) {
  const meta = STATUS_META[status];
  const Icon = STATUS_ICON[status];
  const label = short && status === "RESOLVED" ? "Resolved" : meta.label;

  return (
    <Badge tone={meta.tone} className={className}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const meta = SEVERITY_META[severity];
  return (
    <Badge tone={meta.tone} className={className}>
      {severity === "CRITICAL" && <AlertOctagon className="size-3" aria-hidden="true" />}
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({ score, className }: { score: number; className?: string }) {
  const band = priorityBand(score);
  const meta = PRIORITY_BAND_META[band];
  return (
    <Badge tone={meta.tone} className={className} title={`Priority score ${score.toFixed(0)}`}>
      {meta.label}
    </Badge>
  );
}

export function HostelBadge({ hostel, className }: { hostel: Hostel; className?: string }) {
  return (
    <Badge tone="outline" className={className}>
      {HOSTEL_META[hostel].label}
    </Badge>
  );
}

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <Badge tone="neutral" className={className}>
      {meta.label}
    </Badge>
  );
}

export function EscalationBadge({
  level,
  disputed,
  className,
}: {
  level: number;
  disputed?: boolean;
  className?: string;
}) {
  if (!level && !disputed) return null;
  return (
    <span className={cn("inline-flex gap-1.5", className)}>
      {disputed && (
        <Badge tone="danger">
          <AlertOctagon className="size-3" aria-hidden="true" />
          Disputed
        </Badge>
      )}
      {level > 0 && (
        <Badge tone="danger">
          <ArrowUpCircle className="size-3" aria-hidden="true" />
          {level === 1 ? "With Warden" : "With Coordinator"}
        </Badge>
      )}
    </span>
  );
}

export function SlaBadge({
  dueAt,
  stopped,
  label = "Due",
  className,
}: {
  dueAt: Date | string;
  stopped?: boolean;
  label?: string;
  className?: string;
}) {
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  // Rendered only from server components, so the clock is read once per request
  // and there is no client render for it to disagree with.
  // eslint-disable-next-line react-hooks/purity
  const ms = due.getTime() - Date.now();
  const overdue = ms < 0;
  const soon = !overdue && ms < 4 * 3_600_000;

  if (stopped) {
    return (
      <Badge tone="neutral" className={className}>
        <CheckCircle2 className="size-3" aria-hidden="true" />
        On time
      </Badge>
    );
  }

  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const text =
    hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${Math.floor((abs % 3_600_000) / 60_000)}m`;

  return (
    <Badge tone={overdue ? "danger" : soon ? "warning" : "neutral"} className={className}>
      <Clock className="size-3" aria-hidden="true" />
      {overdue ? `${text} overdue` : `${label} in ${text}`}
    </Badge>
  );
}
