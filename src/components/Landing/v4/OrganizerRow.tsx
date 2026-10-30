/**
 * Zeile „Für Veranstalter" (fn-30.6, Ergänzung des Users vom 30.10.2026):
 * zwischen Newsletter-Zeile und Footer, gleicher `.rowline`-Stil ohne
 * eigene Oberlinie (die Newsletter-Zeile darüber trägt die Haarlinie).
 * Links der Satz, rechts zwei Knöpfe: Event kostenlos eintragen (gefüllt)
 * und Tipp des Tages buchen (Umriss); auf dem Handy untereinander.
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const BUTTON = 'press-haptic inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[10px] px-[18px] text-[14px] font-bold';

export function OrganizerRow() {
  const t = useTranslations('Landing.Organizer');
  return (
    <section
      className="grid gap-3.5 border-t border-b border-[var(--v4-hairline-2)] py-[22px] md:grid-cols-[1.1fr_1fr] md:items-center md:gap-6"
      data-testid="organizer-row"
    >
      <div>
        <h2 className="m-0 mb-1 text-[19px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{t('title')}</h2>
        <p className="m-0 text-[13.5px] text-[var(--v4-ink-50)]">{t('text')}</p>
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
        <Link href="/event-inserieren" className={`${BUTTON} bg-white text-[#0a0a0c]`} data-track="landing_organizer_submit">
          {t('submit')}
        </Link>
        <Link
          href="/fuer-firmen"
          className={`${BUTTON} border border-[var(--v4-hairline-4)] text-[var(--v4-ink)] hover:bg-[var(--v4-hairline-1)]`}
          data-track="landing_organizer_boost"
        >
          {t('boost')}
        </Link>
      </div>
    </section>
  );
}
