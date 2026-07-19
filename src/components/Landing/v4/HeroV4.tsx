import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { V4FunnelCard } from '@/components/Events/v4';
import { V4SearchInput } from '@/components/Layout/v4/V4SearchInput';

const TRENDS = ['Bilderbuch', 'FM4 Frequency', 'Wanda', 'Seefestspiele Mörbisch'];

export function HeroV4() {
  const t = useTranslations('Landing.Hero');
  return (
    <section className="relative overflow-hidden border-b border-[var(--v4-hairline-1)] py-9 md:py-18">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 80% 0%, rgba(212,184,150,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(245,185,66,0.04) 0%, transparent 70%)',
      }}/>

      <div className="relative max-w-[1180px] mx-auto px-4 md:px-14 grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-7 md:gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-4 md:mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--v4-ticket)]" aria-hidden="true"/>
            {t('badge')}
          </div>

          <h1 className="text-[38px] md:text-[60px] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--v4-ink)] max-w-[20ch]">
            {t('title')}
          </h1>

          <p className="text-[14.5px] md:text-[16.5px] leading-snug text-[var(--v4-ink-70)] mt-4 md:mt-6 mb-5 md:mb-8 max-w-[60ch]">
            {t('subtitle')}
          </p>

          <div className="flex gap-2.5 flex-wrap mb-5 md:mb-7">
            <Link
              href="/artists"
              className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
              data-track="cta_artist_search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              {t('ctaArtists')}
            </Link>
            <Link
              href="/entdecken"
              className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)] text-sm font-semibold"
              data-track="cta_browse_events"
            >
              {t('ctaToday')}
            </Link>
          </div>

          <V4SearchInput variant="hero"/>

          <div className="flex gap-2 mt-3.5 flex-wrap items-center text-[11.5px] text-[var(--v4-ink-50)]">
            <span className="font-semibold text-[var(--v4-ink-70)]">{t('trendLabel')}</span>
            {TRENDS.map(tr => (
              <Link
                key={tr}
                href={`/entdecken?search=${encodeURIComponent(tr)}`}
                className="press-haptic px-2.5 py-1 rounded-full border border-[var(--v4-hairline-2)] text-[var(--v4-ink-70)]"
              >
                {tr}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <V4FunnelCard
            ordinal="01" icon="music" accent="match" primary
            title={t('funnel1Title')}
            sub={t('funnel1Sub')}
            cta={t('funnel1Cta')} href="/artists" trackId="funnel_artists"
          />
          <V4FunnelCard
            ordinal="02" icon="map" accent="ticket"
            title={t('funnel2Title')}
            sub={t('funnel2Sub')}
            cta={t('funnel2Cta')} href="/entdecken" trackId="funnel_entdecken"
          />
          <V4FunnelCard
            ordinal="03" icon="ticket" accent="go"
            title={t('funnel3Title')}
            sub={t('funnel3Sub')}
            cta={t('funnel3Cta')} href="/plans" trackId="funnel_plan"
          />
        </div>
      </div>
    </section>
  );
}
