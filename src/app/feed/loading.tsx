export default function FeedLoading() {
  return (
    <div className="min-h-screen bg-surface text-white">
      <div className="max-w-lg mx-auto px-0 py-6">
        {/* Create post skeleton */}
        <div className="px-4 py-3 flex items-center gap-3 animate-pulse motion-reduce:animate-none">
          <div className="w-9 h-9 rounded-full bg-white/[0.06] shrink-0" />
          <div className="flex-1 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
        <div className="h-[6px] bg-white/[0.03] border-t border-white/[0.06]" />
        {/* Feed items skeleton */}
        {[1, 2, 3].map(i => (
          <div key={i} className="border-b border-white/[0.06] animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
              <div className="w-24 h-3 rounded bg-white/[0.06]" />
            </div>
            <div className="aspect-[4/5] w-full bg-white/[0.04]" />
            <div className="flex items-center gap-4 px-4 py-2.5">
              <div className="w-6 h-6 rounded-full bg-white/[0.06]" />
              <div className="w-6 h-6 rounded-full bg-white/[0.06]" />
              <div className="w-6 h-6 rounded-full bg-white/[0.06]" />
            </div>
            <div className="px-4 pb-4 space-y-2">
              <div className="w-20 h-3 rounded bg-white/[0.06]" />
              <div className="w-48 h-3 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
