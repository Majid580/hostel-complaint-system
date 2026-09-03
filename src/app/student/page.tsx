import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  FileQuestion,
  Megaphone,
  Plus,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { complaintCounts, listComplaints } from "@/lib/services/listComplaints";
import { connectDB } from "@/lib/db/mongoose";
import { Announcement } from "@/models";
import { Button } from "@/components/ui/button";
import { Alert, Card, EmptyState } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { ComplaintCard } from "@/components/complaint/ComplaintCard";
import { HOSTEL_META } from "@/lib/domain/constants";

export const metadata = { title: "My complaints" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "actionRequired", label: "Awaiting staff" },
  { key: "closed", label: "Closed" },
] as const;

export default async function StudentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") redirect("/login");

  const params = await searchParams;
  const view = (VIEWS.find((v) => v.key === params.view)?.key ?? "all") as
    | "all"
    | "open"
    | "actionRequired"
    | "closed";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [counts, list] = await Promise.all([
    complaintCounts(user),
    listComplaints(user, {
      view: view === "all" ? undefined : view,
      sort: "newest",
      page,
      limit: 20,
    } as never),
  ]);

  await connectDB();
  const notices = await Announcement.find({
    hostels: user.hostel,
    audience: { $in: ["ALL", "STUDENTS"] },
    startsAt: { $lte: new Date() },
    $or: [{ endsAt: null }, { endsAt: { $gte: new Date() } }],
  })
    .sort({ pinned: -1, startsAt: -1 })
    .limit(2)
    .lean();

  const awaitingConfirmation = list.complaints.filter((c) => c.status === "RESOLVED");

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-semibold leading-tight sm:text-3xl">
            My complaints
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {user.hostel ? HOSTEL_META[user.hostel].label : "Your hostel"} ·{" "}
            <span className="font-mono tracking-tight">{user.regNo}</span>
          </p>
        </div>
        {/* On a phone this action lives in the bottom bar. */}
        <Link href="/student/new" className="hidden lg:block">
          <Button>
            <Plus />
            File a complaint
          </Button>
        </Link>
      </header>

      {/* ---------- Notices ---------- */}
      {notices.map((notice) => (
        <Link
          key={String(notice._id)}
          href="/student/notices"
          className="flex items-start gap-2.5 rounded-xl border border-warning/35 bg-warning/8 px-3 py-2.5 transition-colors hover:bg-warning/12"
        >
          <Megaphone className="mt-0.5 size-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug">{notice.title}</span>
            <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {notice.body}
            </span>
          </span>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}

      {/* ---------- Action required ---------- */}
      {awaitingConfirmation.length > 0 && (
        <Alert
          tone="success"
          title={`${awaitingConfirmation.length} complaint${awaitingConfirmation.length === 1 ? "" : "s"} waiting for your confirmation`}
          icon={<CheckCircle2 className="size-4" />}
        >
          Staff marked{" "}
          {awaitingConfirmation.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/student/complaints/${c.id}`} className="font-mono font-medium text-primary hover:underline">
                {c.code}
              </Link>
            </span>
          ))}{" "}
          as resolved. Please confirm the work was actually done — or report that it was not. If you
          do nothing, it closes automatically after 72 hours.
        </Alert>
      )}

      {/* ---------- Counts ----------
          Four separate cards cost most of a phone screen to show four numbers.
          One rail, divided, reads faster and leaves the list above the fold. */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-border">
          <StatCell label="Filed" value={counts.total} />
          <StatCell label="Open" value={counts.open} />
          <StatCell
            label="Confirm"
            value={counts.resolved}
            tone={counts.resolved > 0 ? "success" : undefined}
          />
          <StatCell
            label="Escalated"
            value={counts.escalated}
            tone={counts.escalated > 0 ? "danger" : undefined}
          />
        </div>
      </Card>

      {/* ---------- Filters ---------- */}
      <Tabs value={view}>
        <TabsList>
          {VIEWS.map((v) => (
            <TabsTrigger key={v.key} value={v.key} asChild>
              <Link href={v.key === "all" ? "/student" : `/student?view=${v.key}`}>{v.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ---------- List ---------- */}
      {list.complaints.length === 0 ? (
        <EmptyState
          icon={<FileQuestion className="size-6" />}
          title={view === "all" ? "You have not filed any complaints yet" : "Nothing here"}
          description={
            view === "all"
              ? "When something in your room or hostel is broken, file it here with photos and a voice note. It reaches your Resident Tutor and the Warden immediately."
              : "Try a different filter."
          }
          action={
            view === "all" ? (
              <Link href="/student/new">
                <Button>
                  <Plus />
                  File your first complaint
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {list.complaints.map((complaint) => (
              <ComplaintCard
                key={complaint.id}
                complaint={complaint}
                href={`/student/complaints/${complaint.id}`}
              />
            ))}
          </div>

          {list.pagination.pages > 1 && (
            <nav className="flex items-center justify-between" aria-label="Pagination">
              <span className="text-sm text-muted-foreground">
                Page {list.pagination.page} of {list.pagination.pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/student?view=${view}&page=${page - 1}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {list.pagination.hasNext && (
                  <Link href={`/student?view=${view}&page=${page + 1}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";

  return (
    <div className="px-2 py-3 text-center sm:py-3.5">
      <p className={`font-display text-[22px] font-semibold leading-none tabular-nums ${toneClass}`}>
        {value}
      </p>
      <p className="mt-1.5 truncate text-[10.5px] uppercase leading-none tracking-[0.07em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
