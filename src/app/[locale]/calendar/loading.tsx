export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-surface text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 animate-pulse motion-reduce:animate-none">
          <div className="h-7 w-32 rounded bg-white/[0.06]" />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-lg bg-white/[0.06]" />
            <div className="h-9 w-9 rounded-lg bg-white/[0.06]" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 animate-pulse motion-reduce:animate-none">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`h-${i}`} className="h-4 rounded bg-white/[0.04] mb-2" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-white/[0.03] border border-white/[0.04]" />
          ))}
        </div>
      </main>
    </div>
  );
}
