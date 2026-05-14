import Link from 'next/link';

export function AnonFollowTeaser() {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Personalisierung · meld dich an
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Wer sind deine Lieblingskünstler?
          </h2>
        </div>
      </div>
      <div className="rounded-[18px] border border-dashed border-[rgba(245,185,66,0.34)] bg-[var(--v4-surface-elevated)] p-5 md:p-8 grid grid-cols-1 md:grid-cols-[60px_1fr_auto] gap-4 items-center">
        <div className="w-12 h-12 rounded-xl border border-[rgba(245,185,66,0.34)] bg-[rgba(245,185,66,0.14)] text-[var(--v4-match)] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <div>
          <p className="text-[16px] md:text-[17px] font-semibold leading-tight text-[var(--v4-ink)] tracking-[-0.015em]">
            Folge Künstler — wir benachrichtigen dich bei Österreich-Terminen.
          </p>
          <p className="text-[13px] text-[var(--v4-ink-70)] mt-1 leading-snug">
            Konzerte, Open Airs, Festival-Slots. Du brauchst nicht ständig nachschauen.
          </p>
        </div>
        <Link
          href="/auth/login?next=/artists"
          data-track="cta_anon_follow"
          className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold whitespace-nowrap"
        >
          Künstler suchen
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
    </section>
  );
}
