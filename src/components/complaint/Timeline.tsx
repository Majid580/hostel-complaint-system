import {
  AlertOctagon,
  ArrowUpCircle,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FileText,
  Lock,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  ThumbsUp,
  Wrench,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";
import { ROLE_META, STATUS_META, type EventAction } from "@/lib/domain/constants";

export type TimelineEntry = {
  id: string;
  action: EventAction;
  actorName: string;
  actorRole: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  visibility: "PUBLIC" | "INTERNAL";
  summary: string;
  meta: Record<string, unknown> | null;
  createdAt: string | Date;
};

const ICON: Partial<Record<EventAction, typeof Circle>> = {
  CREATED: FileText,
  STATUS_CHANGED: CheckCircle2,
  SEVERITY_CHANGED: AlertOctagon,
  WORKER_ASSIGNED: Wrench,
  WORKER_UNASSIGNED: Wrench,
  COMMENT_ADDED: MessageSquare,
  INTERNAL_NOTE_ADDED: Lock,
  ESCALATED: ArrowUpCircle,
  FALSE_RESOLUTION_FLAGGED: ShieldAlert,
  VERIFIED: CheckCircle2,
  REOPENED: RotateCcw,
  REJECTED: XCircle,
  UPVOTED: ThumbsUp,
  AUTO_CLOSED: Clock,
  SLA_BREACHED: AlertOctagon,
  PRIORITY_RECOMPUTED: Eye,
};

const TONE: Partial<Record<EventAction, string>> = {
  ESCALATED: "text-destructive bg-destructive/10",
  FALSE_RESOLUTION_FLAGGED: "text-destructive bg-destructive/10",
  SLA_BREACHED: "text-destructive bg-destructive/10",
  REJECTED: "text-destructive bg-destructive/10",
  REOPENED: "text-warning bg-warning/12",
  VERIFIED: "text-success bg-success/12",
  INTERNAL_NOTE_ADDED: "text-muted-foreground bg-muted",
};

/**
 * The append-only history of a complaint. This is the transparency guarantee:
 * students see every public entry, staff additionally see internal notes.
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>;
  }

  return (
    <ol className="relative space-y-0" aria-label="Complaint history">
      {entries.map((entry, index) => {
        const Icon = ICON[entry.action] ?? Circle;
        const tone = TONE[entry.action] ?? "text-primary bg-primary/10";
        const isLast = index === entries.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border"
              />
            )}

            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", tone)}>
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium leading-snug">{entry.summary}</p>
                {entry.visibility === "INTERNAL" && (
                  <Badge tone="neutral" size="sm">
                    <Lock className="size-3" />
                    Internal
                  </Badge>
                )}
              </div>

              {entry.fromStatus && entry.toStatus && entry.fromStatus !== entry.toStatus && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {STATUS_META[entry.fromStatus as keyof typeof STATUS_META]?.label} →{" "}
                  <span className="font-medium text-foreground">
                    {STATUS_META[entry.toStatus as keyof typeof STATUS_META]?.label}
                  </span>
                </p>
              )}

              {entry.message && (
                <p
                  className={cn(
                    "mt-1.5 whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-2.5 text-sm leading-relaxed",
                    entry.visibility === "INTERNAL" && "border-dashed",
                  )}
                >
                  {entry.message}
                </p>
              )}

              <p className="mt-1.5 text-xs text-muted-foreground">
                {entry.actorRole === "SYSTEM"
                  ? "Automatic"
                  : `${entry.actorName} · ${
                      ROLE_META[entry.actorRole as keyof typeof ROLE_META]?.short ?? entry.actorRole
                    }`}{" "}
                · <time dateTime={new Date(entry.createdAt).toISOString()}>
                  {formatDateTime(entry.createdAt)}
                </time>{" "}
                ({relativeTime(entry.createdAt)})
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
