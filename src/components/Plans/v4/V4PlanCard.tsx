import Link from 'next/link';
import type { Plan } from '@/types/plans';

interface Props {
  plan: Plan;
  eventCount: number;
  previewTitles?: string[];   // up to 2
}

export function V4PlanCard({ plan, eventCount, previewTitles = [] }: Props) {
  const date = new Date(plan.plan_date).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Link href={`/plan/${plan.id}`} className="press-haptic group block rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-5 hover:border-[var(--v4-hairline-3)] transition-colors">
      <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mb-1.5">{date}</p>
      <h3 className="text-[18px] font-bold text-[var(--v4-ink)] tracking-[-0.02em] mb-3 line-clamp-2">{plan.name}</h3>
      <p className="text-[12.5px] text-[var(--v4-ink-70)] mb-2">{eventCount} Event{eventCount === 1 ? '' : 's'}</p>
      {previewTitles.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {previewTitles.slice(0, 2).map((t, i) => (
            <li key={i} className="text-[12px] text-[var(--v4-ink-50)] truncate">&middot; {t}</li>
          ))}
        </ul>
      )}
    </Link>
  );
}
