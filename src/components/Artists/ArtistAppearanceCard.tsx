import Link from 'next/link';
import Image from 'next/image';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { ArtistAppearance } from '@/lib/artists/appearances';

/**
 * Einheitliche, artist-forward Auftritts-Karte — identisch auf Landing
 * ("Auftritte deiner Lieblingskünstler") und /artists ("Gefundene Auftritte").
 * Künstler-Bild (wie /künstler) + "<Künstler> spielt bei <Festival>" bzw.
 * "<Künstler> live", darunter Datum · Ort.
 */

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  // 00:00 = unbekannte Uhrzeit (häufig bei Festival-Tagen) → ohne Zeit
  return time === '00:00' ? date : `${date} · ${time}`;
}

function initial(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : '?';
}

export function ArtistAppearanceCard({ a }: { a: ArtistAppearance }) {
  const href = a.event_id
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

  const isFestival = a.kind === 'festival';

  const inner = (
    <>
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--v4-match)]" />
      {/* Künstler-Bild (rund) */}
      <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--v4-surface)] border border-[var(--v4-hairline-1)] flex-shrink-0 relative flex items-center justify-center">
        {a.artist_image ? (
          <Image src={a.artist_image} alt={a.artist_name} fill sizes="64px" style={{ objectFit: 'cover' }} />
        ) : (
          <span className="text-[20px] font-bold text-[var(--v4-ink-30)]">{initial(a.artist_name)}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[var(--v4-ink)] leading-tight tracking-[-0.015em]">
          <span className="text-[var(--v4-match)]">{a.artist_name}</span>
          {isFestival ? (
            <>
              <span className="text-[var(--v4-ink-70)] font-medium"> spielt bei </span>
              {a.context}
            </>
          ) : (
            <span className="text-[var(--v4-ink-70)] font-medium"> live</span>
          )}
        </p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1 truncate">
          {fmtDate(a.start_date)}
          {a.location_name && ` · ${a.location_name}`}
        </p>
      </div>
    </>
  );

  const cls =
    'press-haptic relative flex items-center gap-3.5 rounded-2xl border border-[rgba(245,185,66,0.34)] bg-[var(--v4-surface-elevated)] p-4 overflow-hidden hover:border-[rgba(245,185,66,0.5)] transition-colors';

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
