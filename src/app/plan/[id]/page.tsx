import { notFound } from 'next/navigation';
import {
  V4PlanHero,
  V4PlanCountdown,
  V4PlanModules,
  V4PlanEventPreview,
  V4PlanFriends,
} from '@/components/Plans/v4';
import { getPlan } from '@/lib/plans/loaders';

export const dynamic = 'force-dynamic';   // user-specific, RLS-gated

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4PlanHero plan={plan}/>
      <V4PlanCountdown plan={plan}/>

      <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-6 md:pt-10">
        <V4PlanModules plan={plan}/>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 md:px-14">
        <V4PlanEventPreview events={plan.events}/>

        {plan.note && (
          <div className="mt-8 md:mt-12 rounded-2xl border border-[var(--v4-match)]/25 bg-[color-mix(in_oklab,var(--v4-match)_5%,var(--v4-surface-elevated))] p-5 md:p-6">
            <p className="text-[10.5px] uppercase tracking-[0.22em] font-bold text-[var(--v4-match)] mb-2">Notiz</p>
            <p className="text-[14px] leading-[1.6] text-[var(--v4-ink)] whitespace-pre-wrap">{plan.note}</p>
          </div>
        )}

        <V4PlanFriends plan={plan}/>
      </div>
    </div>
  );
}
