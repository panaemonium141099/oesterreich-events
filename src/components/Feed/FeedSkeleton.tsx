'use client';

export function FeedItemSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.06] shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-white/[0.06] rounded w-40" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 bg-white/[0.04] rounded w-16" />
            <div className="h-3 bg-white/[0.04] rounded w-20" />
          </div>
          <div className="h-14 bg-white/[0.03] rounded-xl w-full" />
          <div className="flex items-center gap-4 pt-1">
            <div className="h-3 bg-white/[0.04] rounded w-6" />
            <div className="h-3 bg-white/[0.04] rounded w-6" />
            <div className="h-3 bg-white/[0.04] rounded w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <FeedItemSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

export function SidebarFeedItemSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="flex gap-2.5 p-3 animate-pulse"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="w-8 h-8 rounded-full bg-white/[0.06] shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-white/[0.06] rounded w-3/4" />
        <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
        <div className="h-10 bg-white/[0.03] rounded-lg w-full mt-1" />
      </div>
    </div>
  );
}
