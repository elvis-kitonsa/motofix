// PageSkeleton.tsx — grey placeholder boxes shown while a page's data is still loading,
// so the layout doesn't jump around when the real content arrives.

import { Skeleton } from '@/components/ui/skeleton';

interface PageSkeletonProps {
  /** Show a row of stat cards above the table */
  statsCount?: number;
  /** Number of filter controls to show in the filter bar */
  filterCount?: number;
  /** Number of skeleton table rows */
  rows?: number;
  /** Number of table columns */
  cols?: number;
}

export function PageSkeleton({
  statsCount = 0,
  filterCount = 2,
  rows = 7,
  cols = 5,
}: PageSkeletonProps) {
  return (
    <div className="space-y-6 animate-pulse">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
      </div>

      {/* Stats row */}
      {statsCount > 0 && (
        <div className={`grid grid-cols-2 lg:grid-cols-${statsCount} gap-4`}>
          {Array.from({ length: statsCount }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 min-w-[200px] rounded-lg" />
        {Array.from({ length: filterCount - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-40 rounded-lg shrink-0" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex gap-4 px-4 py-3 border-b border-border bg-muted/30">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 rounded" style={{ width: `${100 / cols}%` }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
            {Array.from({ length: cols }).map((_, j) => (
              j === 0
                ? (
                  <div key={j} className="flex items-center gap-3" style={{ width: `${100 / cols}%` }}>
                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-3/4 rounded" />
                      <Skeleton className="h-2.5 w-1/2 rounded" />
                    </div>
                  </div>
                ) : (
                  <Skeleton key={j} className="h-3 rounded" style={{ width: `${100 / cols}%`, opacity: 1 - j * 0.1 }} />
                )
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
