import { useTranslations } from 'next-intl';

const STEPS = [
  { n: '01', titleKey: 'step1Title', textKey: 'step1Text' },
  { n: '02', titleKey: 'step2Title', textKey: 'step2Text' },
  { n: '03', titleKey: 'step3Title', textKey: 'step3Text' },
] as const;

export function HowItWorks() {
  const t = useTranslations('Landing.HowItWorks');
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="mb-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          {t('eyebrow')}
        </p>
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
          {t('title')}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--v4-hairline-1)] rounded-[18px] p-px overflow-hidden">
        {STEPS.map(s => (
          <div key={s.n} className="bg-[var(--v4-surface-elevated)] p-5 md:p-7 rounded-[17px]">
            <div className="text-[30px] mb-3.5" style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--v4-ink-50)', letterSpacing: '-0.02em' }}>
              {s.n}
            </div>
            <div className="text-[17px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] mb-2">{t(s.titleKey)}</div>
            <div className="text-[13px] text-[var(--v4-ink-70)] leading-snug max-w-[36ch]">{t(s.textKey)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
