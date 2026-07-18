export default function SavedLoading() {
  return (
    <div className="min-h-screen bg-surface text-white">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-2 animate-pulse motion-reduce:animate-none">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white/[0.06]" />
            <div className="h-7 w-48 rounded bg-white/[0.06]" />
          </div>
          <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-4 w-28 rounded bg-white/[0.04] mb-8 animate-pulse motion-reduce:animate-none" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="w-16 h-16 rounded-lg bg-white/[0.06] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/[0.06] rounded w-2/3" />
                <div className="h-3 bg-white/[0.04] rounded w-1/3" />
                <div className="h-3 bg-white/[0.04] rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
