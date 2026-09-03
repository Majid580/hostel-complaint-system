import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Download, SearchX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listComplaints } from "@/lib/services/listComplaints";
import { complaintFilterSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { ComplaintCard } from "@/components/complaint/ComplaintCard";
import { QueueFilters } from "@/components/staff/QueueFilters";
import {
  BulkActionBar,
  BulkCheckbox,
  BulkSelectionProvider,
} from "@/components/staff/BulkActions";
import { canExportData } from "@/lib/auth/permissions";
import { HOSTEL_META } from "@/lib/domain/constants";

export const metadata = { title: "Complaints" };
export const dynamic = "force-dynamic";

export default async function StaffQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/student");

  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const parsed = complaintFilterSchema.safeParse(flat);
  const filters = parsed.success
    ? parsed.data
    : complaintFilterSchema.parse({ sort: "priority", page: 1, limit: 20 });

  const list = await listComplaints(user, filters);
  const global = user.role === "WARDEN" || user.role === "COORDINATOR";

  const query = new URLSearchParams(
    Object.entries(flat).filter(([, v]) => Boolean(v)) as [string, string][],
  );

  const pageLink = (page: number) => {
    const next = new URLSearchParams(query.toString());
    next.set("page", String(page));
    return `/staff/complaints?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Complaints</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {global
              ? "All three hostels"
              : user.hostel
                ? HOSTEL_META[user.hostel].label
                : "Your hostel"}{" "}
            · {list.pagination.total} matching
          </p>
        </div>
        {canExportData(user) && (
          <a href="/api/export/complaints" download>
            <Button variant="outline" size="sm">
              <Download />
              Export CSV
            </Button>
          </a>
        )}
      </header>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <QueueFilters basePath="/staff/complaints" showHostel={global} />
      </Suspense>

      {list.complaints.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title="No complaints match these filters"
          description="Try clearing a filter, or widen the search."
          action={
            <Link href="/staff/complaints">
              <Button variant="outline">Clear filters</Button>
            </Link>
          }
        />
      ) : (
        <>
          <BulkSelectionProvider
            items={list.complaints.map((c) => ({ id: c.id, hostel: c.hostel, code: c.code }))}
          >
            <div className="space-y-3">
              {list.complaints.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <BulkCheckbox id={c.id} code={c.code} />
                  <div className="min-w-0 flex-1">
                    <ComplaintCard
                      complaint={c}
                      href={`/staff/complaints/${c.id}`}
                      showHostel={global}
                      showReporter
                    />
                  </div>
                </div>
              ))}
            </div>

            <BulkActionBar />
          </BulkSelectionProvider>

          {list.pagination.pages > 1 && (
            <nav className="flex items-center justify-between" aria-label="Pagination">
              <span className="text-sm text-muted-foreground">
                Page {list.pagination.page} of {list.pagination.pages} · {list.pagination.total}{" "}
                complaints
              </span>
              <div className="flex gap-2">
                {list.pagination.page > 1 && (
                  <Link href={pageLink(list.pagination.page - 1)}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {list.pagination.hasNext && (
                  <Link href={pageLink(list.pagination.page + 1)}>
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
