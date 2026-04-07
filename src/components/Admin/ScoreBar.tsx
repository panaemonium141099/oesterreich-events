export function ScoreBar({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const pct = Math.min(Math.max((score / maxScore) * 100, 0), 100);
  const color =
    pct >= 60
      ? 'bg-emerald-500'
      : pct >= 40
        ? 'bg-amber-500'
        : pct >= 20
          ? 'bg-orange-500'
          : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white/50 w-8 text-right">{Math.round(score)}</span>
    </div>
  );
}
