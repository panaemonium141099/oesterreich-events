/**
 * Zeitungskopf der Tagesausgabe (fn-30.5, Mockup D `.mast`): Datumszeile,
 * H1 und die Suche. Statisches HTML bis auf die DateLine-Insel.
 */

import { useTranslations } from 'next-intl';
import { V4SearchInput } from '@/components/Layout/v4/V4SearchInput';
import { DateLine } from './DateLine';

export function Masthead({ today, countryTotal }: { today: string; countryTotal: number | null }) {
  const t = useTranslations('Landing.Masthead');

  return (
    <header
      className="grid grid-cols-1 items-end gap-x-10 gap-y-[18px] pb-[18px] pt-[18px] md:pt-[26px] lg:grid-cols-[minmax(0,1fr)_auto]"
      data-testid="masthead"
    >
      <div className="min-w-0">
        <DateLine today={today} countryTotal={countryTotal}/>
        <h1 className="m-0 text-[38px] font-extrabold leading-none tracking-[-0.04em] text-[var(--v4-ink)] md:text-[46px]">
          {t('title')}
        </h1>
      </div>
      <div className="w-full lg:w-[420px]">
        <V4SearchInput variant="hero"/>
      </div>
    </header>
  );
}
