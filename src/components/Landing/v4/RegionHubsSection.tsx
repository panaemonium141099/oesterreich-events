'use client';

/**
 * "Events nach Bundesland" — v4 landing section (design section 02b).
 *
 * Each Bundesland is a clickable photo tile. Tapping opens a HYBRID sheet:
 *   • primary "Alle Events in <BL>" CTA  → /entdecken?bl=<id>
 *   • a Bezirk picker                     → /entdecken?bl=<id>&district=<bezirk>
 * Both land on the existing /entdecken list, pre-scoped. The Bezirk value is
 * the exact `district` field the events carry, so the picker filters for real.
 *
 * Bundesland tiles use real CC photos (public/images/regions/{id}.jpg). The
 * Bezirk rows use an accent marker — there are ~113 Bezirke, so per-Bezirk
 * photos aren't practical (and faking it would look worse than a clean marker).
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BUNDESLAND_HUBS, type BundeslandHubEntry } from '@/lib/hubs/bundesland-regions';
import { buildEntdeckenHref } from '@/lib/hubs/hub-links';
import { blImg } from '@/lib/hubs/region-slug';
import {
  DISTRICTS_BY_BUNDESLAND,
  displayDistrictName,
  type BundeslandId,
} from '@/lib/districtsAT';

// ── tokens (mapped to globals.css v4 vars) ──────────────────────────────────
const INK = 'var(--v4-ink)';
const INK70 = 'var(--v4-ink-70)';
const INK50 = 'var(--v4-ink-50)';
const HL2 = 'var(--v4-hairline-2)';
const HL3 = 'var(--v4-hairline-3)';
const ELEV = 'var(--v4-surface-elevated)';
const TICKET = 'var(--v4-ticket)';
const TICKET_SOFT = 'rgba(212,184,150,0.12)';
const TICKET_BORDER = 'rgba(212,184,150,0.32)';

const TILE_BG =
  'radial-gradient(120% 85% at 100% 0%, rgba(212,184,150,0.10), transparent 56%), linear-gradient(165deg, #17171b 0%, #0c0c0e 72%)';

function bezirke(blId: string) {
  return DISTRICTS_BY_BUNDESLAND[blId as BundeslandId] ?? [];
}

// ── inline icons ────────────────────────────────────────────────────────────
function Ic({ d, size = 14, sw = 2 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const PIN = 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z M12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z';
const ARROW_R = 'M5 12h14 M13 6l6 6-6 6';
const CHEV_R = 'M9 6l6 6-6 6';
const X = 'M6 6l12 12 M18 6L6 18';
const LAYERS = 'M12 3 3 8l9 5 9-5-9-5Z M3 13l9 5 9-5';

// ── tile ────────────────────────────────────────────────────────────────────
function BLTile({
  bl, feature, onPick, t,
}: {
  bl: BundeslandHubEntry;
  feature?: boolean;
  onPick: (bl: BundeslandHubEntry) => void;
  t: ReturnType<typeof useTranslations<'Landing.RegionHubs'>>;
}) {
  const count = bezirke(bl.id).length;
  return (
    <button
      type="button"
      onClick={() => onPick(bl)}
      aria-label={t('tileAria', { name: bl.name })}
      className={`group relative block h-full w-full overflow-hidden text-left transition-colors ${feature ? 'col-span-2 md:row-span-2' : ''}`}
      style={{
        border: `1px solid ${HL2}`,
        borderRadius: feature ? 20 : 16,
        background: TILE_BG,
        color: INK,
        padding: 0,
        cursor: 'pointer',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bl.img ?? blImg(bl.id)} alt="" loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        style={{ filter: 'saturate(0.95) brightness(0.8)' }} />
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to top, rgba(5,5,6,0.94) 0%, rgba(5,5,6,0.5) 40%, rgba(5,5,6,0.12) 74%)',
      }} />

      {/* count pill */}
      <span className="absolute inline-flex items-center gap-1.5"
        style={{
          top: feature ? 16 : 12, left: feature ? 16 : 12,
          padding: '5px 10px 5px 8px', borderRadius: 9999,
          background: 'rgba(10,10,12,0.62)', backdropFilter: 'blur(8px)',
          border: `1px solid ${HL3}`, color: INK, fontSize: 11.5, fontWeight: 600,
        }}>
        <span style={{ color: TICKET }}><Ic d={PIN} size={11} /></span>
        {t('districtCount', { count })}
      </span>

      {/* name block */}
      <div className="absolute" style={{ left: feature ? 18 : 14, right: 14, bottom: feature ? 16 : 13 }}>
        <div style={{
          fontSize: feature ? 30 : 20, fontWeight: 700, letterSpacing: '-0.03em',
          lineHeight: 1.04, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,0.5)',
        }}>{bl.name}</div>
        <div className="flex items-center gap-1.5"
          style={{ marginTop: feature ? 6 : 4, fontSize: feature ? 12.5 : 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
          <span>{t('districtCount', { count })}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ color: TICKET }}>{t('choose')}</span>
          <span className="transition-transform group-hover:translate-x-0.5"><Ic d={ARROW_R} size={12} sw={2.4} /></span>
        </div>
      </div>
    </button>
  );
}

// ── hybrid sheet ─────────────────────────────────────────────────────────────
function BundeslandSheet({
  bl, onClose, t,
}: {
  bl: BundeslandHubEntry;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<'Landing.RegionHubs'>>;
}) {
  const districts = bezirke(bl.id);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex justify-center"
      style={{
        background: 'rgba(5,5,6,0.74)', backdropFilter: 'blur(6px)',
        alignItems: 'center', padding: 24,
      }}
      role="dialog" aria-modal="true" aria-label={t('sheetAria', { name: bl.name })}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full flex-col overflow-hidden"
        style={{
          maxWidth: 560, background: ELEV, color: INK,
          border: `1px solid ${HL3}`, borderRadius: 22,
          boxShadow: '0 32px 90px rgba(0,0,0,0.62)',
        }}
      >
        {/* banner */}
        <div className="relative shrink-0" style={{ height: 152, background: TILE_BG }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bl.img ?? blImg(bl.id)} alt="" className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.95) brightness(0.78)' }} />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to top, rgba(20,20,22,0.98) 0%, rgba(20,20,22,0.45) 55%, rgba(20,20,22,0.2) 100%)',
          }} />
          <button type="button" onClick={onClose} aria-label={t('close')}
            className="absolute flex items-center justify-center"
            style={{
              top: 12, right: 12, width: 32, height: 32, borderRadius: 9999,
              border: `1px solid ${HL3}`, background: 'rgba(10,10,12,0.55)',
              backdropFilter: 'blur(8px)', color: INK, cursor: 'pointer',
            }}>
            <Ic d={X} size={16} sw={2.2} />
          </button>
          <div className="absolute" style={{ left: 22, bottom: 14 }}>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 6 }}>
              {t('bundesland')}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
              {bl.name}
            </div>
          </div>
        </div>

        {/* body */}
        <div className="overflow-y-auto" style={{ padding: '20px 22px 24px' }}>
          {/* Route A — all events */}
          <Link
            href={buildEntdeckenHref({ bundesland: bl.id })}
            className="flex w-full items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{
              padding: '13px 16px', borderRadius: 12, background: TICKET,
              color: '#0a0a0c', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
            }}>
            {t('allEventsIn', { name: bl.name })}
            <Ic d={ARROW_R} size={14} sw={2.5} />
          </Link>
          <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: INK50, marginTop: 8, paddingLeft: 2 }}>
            <Ic d={LAYERS} size={12} sw={1.9} />
            {t('opensFiltered', { name: bl.name })}
          </div>

          {/* divider */}
          <div className="flex items-center gap-3" style={{ margin: '20px 0 14px' }}>
            <div style={{ flex: 1, height: 1, background: HL2 }} />
            <span style={{ fontSize: 10.5, color: INK50, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', whiteSpace: 'nowrap' }}>
              {t('orDistrict')}
            </span>
            <div style={{ flex: 1, height: 1, background: HL2 }} />
          </div>

          {/* Route B — Bezirk picker (real ?district= filter) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {districts.map((d) => (
              <Link
                key={d.name}
                href={buildEntdeckenHref({ bundesland: bl.id, district: d.name })}
                className="flex items-center gap-2.5 transition-colors hover:border-white/20"
                style={{
                  padding: '10px 12px', borderRadius: 12, background: 'var(--v4-surface-inset)',
                  border: `1px solid ${HL2}`, color: INK,
                }}>
                <span className="flex shrink-0 items-center justify-center"
                  style={{ width: 32, height: 32, borderRadius: 8, background: TICKET_SOFT, color: TICKET, border: `1px solid ${TICKET_BORDER}` }}>
                  <Ic d={PIN} size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {displayDistrictName(d.name)}
                  </span>
                </span>
                <span style={{ color: INK50 }} className="shrink-0"><Ic d={CHEV_R} size={15} /></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── section ──────────────────────────────────────────────────────────────────
export function RegionHubsSection() {
  const t = useTranslations('Landing.RegionHubs');
  const [picked, setPicked] = useState<BundeslandHubEntry | null>(null);

  // Esc closes the sheet; lock body scroll while open.
  const close = useCallback(() => setPicked(null), []);
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [picked, close]);

  const feature = BUNDESLAND_HUBS.find((b) => b.feature);
  const rest = BUNDESLAND_HUBS.filter((b) => !b.feature);

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10" aria-label={t('sectionAria')}>
      <div className="mb-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          {t('eyebrow')}
        </p>
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
          {t('title')}
        </h2>
        <p className="text-[14.5px] leading-[1.55] text-[var(--v4-ink-70)] mt-2 mb-[18px] max-w-[600px]">
          {t.rich('intro', {
            b: chunks => <b className="font-semibold text-[var(--v4-ink)]">{chunks}</b>,
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 auto-rows-[138px] md:grid-cols-4 md:auto-rows-[152px]">
        {feature && <BLTile bl={feature} feature onPick={setPicked} t={t} />}
        {rest.map((bl) => (
          <BLTile key={bl.id} bl={bl} onPick={setPicked} t={t} />
        ))}
      </div>

      <p style={{ fontSize: 11, color: INK50, marginTop: 14, lineHeight: 1.5 }}>
        {t('credit')}{' '}
        <Link href="/bildnachweis" style={{ color: INK70, textDecoration: 'underline' }}>
          {t('creditLink')}
        </Link>
      </p>

      {picked && <BundeslandSheet bl={picked} onClose={close} t={t} />}
    </section>
  );
}
