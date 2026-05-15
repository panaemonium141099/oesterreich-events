import type { PlanWithEvents } from '@/types/plans';
import { V4BackButton } from '@/components/Events/v4/V4BackButton';

export function V4PlanHero({ plan }: { plan: PlanWithEvents }) {
  const date = new Date(plan.plan_date).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section className="relative border-b border-[var(--v4-hairline-1)] py-10 md:py-16">
      <V4BackButton fallback="/saved" className="top-5 left-4 md:left-14"/>
      <div className="max-w-[1180px] mx-auto px-4 md:px-14">
        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Mein Plan &middot; {date}</p>
        <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06] mb-2" style={{ textWrap: 'balance' }}>
          {plan.name}
        </h1>
        <p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)]">
          {plan.event_count} Event{plan.event_count === 1 ? '' : 's'}{plan.note ? ' · mit Notiz' : ''}
        </p>
      </div>
    </section>
  );
}
