'use client';

import { useEffect, useState } from 'react';
import { V4PlansList } from '@/components/Plans/v4';
import type { Plan } from '@/types/plans';

export function V4SavedPageClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/plans');
        if (res.ok) {
          const data = await res.json();
          if (alive) setPlans(data.plans ?? []);
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <section className="border-b border-[var(--v4-hairline-1)] py-8 md:py-14">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Meine Pläne</p>
          <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06]" style={{ textWrap: 'balance' }}>
            Was hast du dir{' '}
            <span style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}>vorgenommen?</span>
          </h1>
        </div>
      </section>
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12">
        {loading ? (
          <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade Pläne …</div>
        ) : (
          <V4PlansList plans={plans}/>
        )}
      </div>
    </div>
  );
}
