const STATUS_STYLES: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  published_low_confidence: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  needs_review: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  suppressed: 'bg-red-500/20 text-red-400 border-red-500/30',
  duplicate: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
