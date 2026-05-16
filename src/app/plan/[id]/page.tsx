import { notFound } from 'next/navigation';
import { V4PlanHero, V4PlanTimeline, V4PlanStatusSection } from '@/components/Plans/v4';
import { getPlan } from '@/lib/plans/loaders';

export const dynamic = 'force-dynamic';   // user-specific, RLS-gated

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4PlanHero plan={plan}/>
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12">
        <V4PlanStatusSection plan={plan}/>
        {plan.note && (
          <div className="rounded-2xl border border-[rgba(245,185,66,0.28)] bg-[rgba(245,185,66,0.06)] p-4 md:p-5 mb-6">
            <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-match)] mb-1.5">Notiz</p>
            <p className="text-[14px] leading-[1.55] text-[var(--v4-ink)] whitespace-pre-wrap">{plan.note}</p>
          </div>
        )}
        <V4PlanTimeline events={plan.events}/>
      </div>
    </div>
  );
}
