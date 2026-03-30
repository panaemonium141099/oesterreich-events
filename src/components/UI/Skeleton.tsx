export function SkeletonCard({ eveningMode }: { eveningMode?: boolean }) {
  return (
    <div className="flex gap-3 p-3 animate-fade-in" style={{ animationDuration: '0.3s' }}>
      <div className={`skeleton w-20 h-20 rounded-lg shrink-0 ${eveningMode ? '' : ''}`} />
      <div className="flex-1 space-y-2 py-1">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5, eveningMode }: { count?: number; eveningMode?: boolean }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 80}ms` }}>
          <SkeletonCard eveningMode={eveningMode} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3'];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton h-3 ${widths[i % widths.length]} rounded`} />
      ))}
    </div>
  );
}
