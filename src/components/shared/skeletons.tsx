import { Card, CardContent, Skeleton } from "@/components/ui/primitives";

/**
 * Placeholders shown while a server page streams in. They deliberately mirror
 * the real layout's spacing so the content does not jump when it arrives.
 */

function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

/** A stack of complaint cards — the student and staff queues. */
export function ListSkeleton({ rows = 4, tiles = 0 }: { rows?: number; tiles?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <PageHeaderSkeleton />

      {tiles > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: tiles }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 pt-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2.5 h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 pt-4">
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** A single complaint, student or staff variant. */
export function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-32" />

      <Card>
        <CardContent className="p-5 pt-5">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="mt-2 h-7 w-3/4" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-12 w-full rounded-xl" />
          <div className="mt-5 space-y-2 border-t border-border pt-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5 pt-5">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
