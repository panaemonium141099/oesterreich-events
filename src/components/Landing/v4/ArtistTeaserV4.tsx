import Link from 'next/link';
import type { LandingArtist } from '@/lib/v4/get-landing-data';
import { V4Badge } from '@/components/Events/v4';

interface ArtistTeaserV4Props {
  artists: LandingArtist[];
}

export function ArtistTeaserV4({ artists }: ArtistTeaserV4Props) {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="rounded-[22px] border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)] p-6 md:p-9 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-5 md:gap-9 items-center">
        <div>
          <V4Badge kind="match">Lieblingskünstler · nur eingeloggt</V4Badge>
          <h2 className="text-[26px] md:text-[36px] font-bold leading-tight tracking-[-0.025em] mt-3.5 mb-2.5 text-[var(--v4-ink)]">
            Verpasse keinen Auftritt deiner Lieblingskünstler.
          </h2>
          <p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)] leading-snug max-w-[60ch] mb-5">
            Such einen Künstler, folge ihm und wir zeigen dir Konzerte und Festival-Slots in Österreich.
          </p>
          <Link
            href="/artists"
            data-track="cta_artist_search"
            className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            Zu deinen Lieblingskünstlern
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
          <p className="text-[11.5px] text-[var(--v4-ink-50)] mt-2.5">
            Öffnet die Künstler-Seite. Folgen erfordert eine Anmeldung.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface)] p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)] mb-2">
            Beliebt in Österreich
          </p>
          {artists.slice(0, 3).map((a, i) => (
            <Link
              key={a.name}
              href={`/artists?artist=${encodeURIComponent(a.name)}`}
              data-track="artist_preview"
              className={'press-haptic flex items-center gap-3 py-2.5 ' + (i > 0 ? 'border-t border-[var(--v4-hairline-1)]' : '')}
            >
              <div className="w-9 h-9 rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] flex items-center justify-center text-[var(--v4-ink)]"
                style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 16 }}>
                {a.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-[var(--v4-ink)]">{a.name}</div>
                {a.genre && <div className="text-[11px] text-[var(--v4-ink-50)] mt-0.5">{a.genre}</div>}
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--v4-ink-50)' }}><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
