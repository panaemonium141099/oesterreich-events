import Link from 'next/link';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { ArtistAppearance } from '@/lib/artists/appearances';

/**
 * Zusammengefasste Auftritts-Karte für Künstler mit mehreren anstehenden
 * Terminen (Landing "Auftritte deiner Lieblingskünstler"). Zugeklappt eine
 * Zeile pro Künstler ("tritt 3× auf" + Zeitraum), aufgeklappt die einzelnen
 * Termine als Links. Natives <details> — kein Client-JS nötig, gleiche
 * Optik wie ArtistAppearanceCard.
 */

function fmtDate(iso: string, withTime = true): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  if (!withTime) return date;
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  // 00:00 = unbekannte Uhrzeit (häufig bei Festival-Tagen) → ohne Zeit
  return time === '00:00' ? date : `${date} · ${time}`;
}

function initial(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : '?';
}

function eventHref(a: ArtistAppearance): string | null {
  return a.event_id
    ? buildEventUrlV2({
        id: a.event_id,
        slug: a.event_slug,
        start_date: a.start_date,
        postal_code: a.postal_code,
        address: null,
        bundesland: a.bundesland,
        location_name: a.location_name,
      })
    : null;
}

export function ArtistAppearanceGroup({ appearances }: { appearances: ArtistAppearance[] }) {
  const first = appearances[0];
  const last = appearances[appearances.length - 1];
  const range =
    appearances.length > 1
      ? `${fmtDate(first.start_date, false)} – ${fmtDate(last.start_date, false)}`
      : fmtDate(first.start_date);

  return (
    <details className="group relative rounded-2xl border border-[rgba(245,185,66,0.34)] bg-[var(--v4-surface-elevated)] overflow-hidden hover:border-[rgba(245,185,66,0.5)] transition-colors">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--v4-match)]" />
      <summary className="press-haptic flex items-center gap-3.5 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--v4-surface)] border border-[var(--v4-hairline-1)] flex-shrink-0 flex items-center justify-center">
          {first.artist_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first.artist_image} alt={first.artist_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[20px] font-bold text-[var(--v4-ink-30)]">{initial(first.artist_name)}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[var(--v4-ink)] leading-tight tracking-[-0.015em]">
            <span className="text-[var(--v4-match)]">{first.artist_name}</span>
            <span className="text-[var(--v4-ink-70)] font-medium"> tritt {appearances.length}× auf</span>
          </p>
          <p className="text-[12px] text-[var(--v4-ink-50)] mt-1 truncate">{range}</p>
        </div>

        <svg
          className="flex-shrink-0 text-[var(--v4-ink-50)] transition-transform group-open:rotate-90"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </summary>

      <ul className="border-t border-[var(--v4-hairline-1)]">
        {appearances.map((a, i) => {
          const href = eventHref(a);
          const inner = (
            <>
              <span className="text-[13px] text-[var(--v4-ink)] font-medium">
                {fmtDate(a.start_date)}
                {a.location_name && <span className="text-[var(--v4-ink-50)] font-normal"> · {a.location_name}</span>}
              </span>
              {a.kind === 'festival' && a.context && (
                <span className="text-[12px] text-[var(--v4-ink-50)]">spielt bei {a.context}</span>
              )}
            </>
          );
          const cls = 'press-haptic flex flex-col gap-0.5 pl-[4.6rem] pr-4 py-3 hover:bg-[var(--v4-surface)] transition-colors';
          return (
            <li key={`${a.event_id ?? a.context}-${i}`} className="border-b border-[var(--v4-hairline-1)] last:border-b-0">
              {href ? (
                <Link href={href} className={cls}>{inner}</Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
