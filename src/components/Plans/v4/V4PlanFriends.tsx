'use client';

/**
 * V4PlanFriends — Sharing-Modul nach Designer 06b.
 *
 * Dashed-Border-Card mit "Geht jemand mit?" + Share/Einladen-Buttons.
 * Sharing-Funktionalität ist Stub (Phase-6-Sharing-API noch nicht
 * implementiert) — Buttons öffnen das native Share-Sheet wenn verfügbar.
 */

import type { PlanWithEvents } from '@/types/plans';

interface Props {
  plan: PlanWithEvents;
}

export function V4PlanFriends({ plan }: Props) {
  function handleShare() {
    if (typeof navigator === 'undefined') return;
    const url = typeof window !== 'undefined' ? window.location.href : `/plan/${plan.id}`;
    const shareApi = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    if (typeof shareApi === 'function') {
      shareApi.call(navigator, {
        title: plan.name,
        text: `Schau dir meinen Plan an: ${plan.name}`,
        url,
      }).catch(() => { /* user cancelled */ });
      return;
    }
    const clip = (navigator as Navigator & { clipboard?: { writeText: (s: string) => Promise<void> } }).clipboard;
    if (clip?.writeText) {
      clip.writeText(url);
    }
  }

  return (
    <section className="mt-8 md:mt-14 mb-12 md:mb-20">
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] p-5 md:p-7 grid grid-cols-1 md:grid-cols-[52px_1fr_auto] items-center gap-4 md:gap-5">
        <div className="w-11 h-11 rounded-xl bg-[var(--v4-surface-inset)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink-70)] flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em]">Geht jemand mit?</p>
          <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-1 leading-relaxed">
            Teile diesen Plan oder lade Freund:innen ein — wir öffnen das Share-Sheet deines Geräts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:flex-nowrap">
          <button
            type="button"
            onClick={handleShare}
            data-track="plan_share"
            className="press-haptic inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--v4-hairline-2)] text-[12.5px] font-semibold text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Teilen
          </button>
        </div>
      </div>
    </section>
  );
}
