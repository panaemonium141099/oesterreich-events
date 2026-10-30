'use client';

/**
 * Client-Insel der Programmliste „Heute Abend" (fn-30.6).
 *
 * Die Zeilen selbst rendert `ProgramList` auf dem Server (EventImage ist
 * eine Server-Komponente) und reicht sie fertig als ReactNodes herein. Die
 * Insel zeigt zunächst alle Zeilen (gleiches HTML wie der Server, keine
 * Hydrations-Warnung) und blendet nach dem Laden Zeilen aus, deren Start
 * mehr als 60 Minuten zurückliegt oder die nicht mehr zum aktuellen Wiener
 * Tag gehören (DateLine meldet den Tag nach Mitternacht über
 * `useViennaDay`). Ohne sichtbare Zeile entfällt der Abschnitt. Der Link
 * „Ganzes Programm" zeigt immer den aktuellen Tag.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useViennaDay } from '@/lib/landing/vienna-day';
import { weekdayLabel } from '@/lib/landing/day-labels';
import { parseEventDate, toViennaDate } from '@/lib/utils/event-time';

export interface ProgramItem {
  id: string;
  /** start_date des Events (ISO). */
  start: string;
  node: ReactNode;
}

/** Zeilen bleiben bis 60 Minuten nach ihrem Beginn stehen. */
export const PROGRAM_GRACE_MS = 60 * 60_000;

/** Sichtbar: Start höchstens 60 Minuten her und am aktuellen Wiener Tag. */
export function programRowVisible(start: string, now: Date, day: string): boolean {
  const d = parseEventDate(start);
  if (!d) return false;
  if (d.getTime() < now.getTime() - PROGRAM_GRACE_MS) return false;
  return toViennaDate(d) === day;
}

/** Link auf die Liste eines einzelnen Tages. */
export function programHref(day: string): string {
  return `/entdecken?von=${day}&bis=${day}`;
}

const ROW_RULES = '[&>a]:border-t [&>a]:border-[var(--v4-hairline-2)] [&>a:first-child]:border-t-0 md:[&>a:nth-child(2)]:border-t-0';

export function ProgramListIsland({ today, items }: { today: string; items: ProgramItem[] }) {
  const t = useTranslations('Landing.Program');
  const locale = useLocale();
  const day = useViennaDay(today);
  // null = Server-Stand, alle Zeilen; erst der Effekt filtert.
  const [visible, setVisible] = useState<Set<string> | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setVisible(new Set(items.filter(i => programRowVisible(i.start, now, day)).map(i => i.id)));
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [items, day]);

  const rows = visible ? items.filter(i => visible.has(i.id)) : items;
  if (rows.length === 0) return null;

  return (
    <section className="mt-10" data-testid="program-list">
      <div className="mb-2.5 flex items-baseline gap-3">
        <h2 className="m-0 whitespace-nowrap text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">
          {t('title')}
        </h2>
        <span className="hidden text-[13.5px] text-[var(--v4-ink-50)] md:inline" data-testid="program-sub">
          {t('sub', { day: weekdayLabel(day, locale) })}
        </span>
        <Link
          href={programHref(day)}
          className="press-haptic ml-auto whitespace-nowrap text-[13px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
          data-track="landing_program_all"
        >
          {t('all')} ›
        </Link>
      </div>
      <div className={`grid gap-x-10 md:grid-cols-2 ${ROW_RULES}`}>
        {rows.map(i => i.node)}
      </div>
    </section>
  );
}
