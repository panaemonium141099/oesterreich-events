export default function MessagesLoading() {
  return (
    <div className="min-h-screen bg-surface text-white">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 animate-pulse motion-reduce:animate-none">
          <div className="h-7 w-40 bg-white/[0.06] rounded" />
          <div className="h-[44px] w-36 bg-white/[0.06] rounded-xl" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse motion-reduce:animate-none"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="w-11 h-11 rounded-full bg-white/[0.06] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/[0.06] rounded w-1/3" />
                <div className="h-3 bg-white/[0.06] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
