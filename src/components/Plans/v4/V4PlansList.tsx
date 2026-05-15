'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Plan } from '@/types/plans';
import { V4PlanCard } from './V4PlanCard';

interface Props {
  plans: Plan[];
  /** Optional per-plan event count + previews. Map plan_id → meta. */
  meta?: Record<string, { count: number; previews: string[] }>;
}

export function V4PlansList({ plans, meta = {} }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const filtered = plans.filter(p =>
    tab === 'upcoming' ? p.plan_date >= today : p.plan_date < today,
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div role="tablist" aria-label="Plan-Filter" className="inline-flex p-1 rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]">
          {(['upcoming', 'past'] as const).map(k => {
            const isActive = tab === k;
            const label = k === 'upcoming' ? 'Aktuelle Pläne' : 'Vergangene';
            return (
              <button key={k} role="tab" aria-selected={isActive} onClick={() => setTab(k)} className={'press-haptic px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ' + (isActive ? 'bg-[var(--v4-ink)] text-[#0a0a0c]' : 'text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]')}>{label}</button>
            );
          })}
        </div>
        <Link href="/plan/new" className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13px] font-semibold">
          + Neuer Plan
        </Link>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">{tab === 'upcoming' ? 'Du hast noch keinen Plan für demnächst.' : 'Noch keine vergangenen Pläne.'}</p>
          {tab === 'upcoming' && (
            <Link href="/plan/new" className="press-haptic mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]">+ Ersten Plan anlegen</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(p => (
            <V4PlanCard key={p.id} plan={p} eventCount={meta[p.id]?.count ?? 0} previewTitles={meta[p.id]?.previews ?? []}/>
          ))}
        </div>
      )}
    </div>
  );
}
