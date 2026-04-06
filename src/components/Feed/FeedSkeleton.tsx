'use client';

export function FeedItemSkeleton() {
  return (
    <div className="border-b border-slate-200 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-1.5">
          <div className="w-24 h-3 rounded bg-slate-100" />
        </div>
      </div>
      {/* Image placeholder */}
      <div className="aspect-[4/5] w-full bg-slate-50" />
      {/* Action row */}
      <div className="flex items-center gap-4 px-4 py-2.5">
        <div className="w-6 h-6 rounded-full bg-slate-100" />
        <div className="w-6 h-6 rounded-full bg-slate-100" />
        <div className="w-6 h-6 rounded-full bg-slate-100" />
      </div>
      {/* Text lines */}
      <div className="px-4 pb-4 space-y-2">
        <div className="w-20 h-3 rounded bg-slate-100" />
        <div className="w-48 h-3 rounded bg-slate-50" />
      </div>
    </div>
  );
}

export function FeedSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <FeedItemSkeleton key={i} />
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
      <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-slate-100 rounded w-3/4" />
        <div className="h-2.5 bg-slate-50 rounded w-1/2" />
        <div className="h-10 bg-slate-50 rounded-lg w-full mt-1" />
      </div>
    </div>
  );
}
