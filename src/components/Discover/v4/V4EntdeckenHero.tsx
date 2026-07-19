'use client';

import { useTranslations } from 'next-intl';
import { V4EntdeckenTabs, type V4EntdeckenMode } from '@/components/Events/v4';

interface V4EntdeckenHeroProps {
  mode: V4EntdeckenMode;
  onModeChange: (next: V4EntdeckenMode) => void;
}

export function V4EntdeckenHero({ mode, onModeChange }: V4EntdeckenHeroProps) {
  const t = useTranslations('Discover');
  return (
    <section className="py-6 md:py-10">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14">
        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">{t('eyebrow')}</p>
        <h1 className="m-0 text-[30px] md:text-[38px] font-bold tracking-[-0.03em] text-[var(--v4-ink)] leading-[1.05]">
          {t('title')}
        </h1>
        <p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)] leading-[1.55] mt-3 mb-6 max-w-[620px]">
          {t('subtitle')}
        </p>
        <V4EntdeckenTabs current={mode} onChange={onModeChange}/>
      </div>
    </section>
  );
}
