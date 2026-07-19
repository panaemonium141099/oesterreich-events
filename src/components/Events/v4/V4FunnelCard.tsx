/**
 * V4FunnelCard — Landing-Hero CTA card.
 *
 * Used 3x in HeroV4 as the right-column stack (Künstler folgen /
 * Events entdecken / Abend planen). Not a card-for-events; this is a
 * primary nav CTA that happens to be styled like an info row.
 *
 * Pure RSC. press-haptic class for touch feedback; no JS state.
 */

import { Link } from '@/i18n/navigation';
import type { SVGProps } from 'react';

interface V4FunnelCardProps {
  ordinal: string;
  icon: 'music' | 'map' | 'ticket';
  title: string;
  sub: string;
  cta: string;
  href: string;
  accent: 'match' | 'ticket' | 'go';
  primary?: boolean;
  trackId?: string;
}

function FunnelIcon({ name, ...rest }: { name: V4FunnelCardProps['icon'] } & SVGProps<SVGSVGElement>) {
  const common = {
    width: 18, height: 18, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true, ...rest,
  };
  if (name === 'music')  return <svg {...common}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
  if (name === 'map')    return <svg {...common}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
  /* ticket */            return <svg {...common}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/></svg>;
}

// RGBA equivalents for tint+border. CSS-variable alpha math via Tailwind
// arbitrary-value is fragile across color spaces; inline rgba is predictable.
const ACCENT_RGB: Record<V4FunnelCardProps['accent'], { fg: string; tint: string; border: string }> = {
  match:  { fg: 'var(--v4-match)',  tint: 'rgba(245,185,66,0.12)',  border: 'rgba(245,185,66,0.34)' },
  ticket: { fg: 'var(--v4-ticket)', tint: 'rgba(212,184,150,0.12)', border: 'rgba(212,184,150,0.34)' },
  go:     { fg: 'var(--v4-go)',     tint: 'rgba(123,183,148,0.12)', border: 'rgba(123,183,148,0.34)' },
};

export function V4FunnelCard({ ordinal, icon, title, sub, cta, href, accent, primary, trackId }: V4FunnelCardProps) {
  const a = ACCENT_RGB[accent];

  return (
    <Link
      href={href}
      data-track={trackId}
      className={
        'press-haptic flex items-center gap-4 rounded-2xl p-4 md:p-5 border transition-colors ' +
        (primary
          ? 'bg-[var(--v4-surface)] border-[rgba(212,184,150,0.34)] hover:border-[rgba(212,184,150,0.5)]'
          : 'bg-[var(--v4-surface-elevated)] border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)]')
      }
    >
      <div
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border"
        style={{ background: a.tint, color: a.fg, borderColor: a.border }}
      >
        <FunnelIcon name={icon}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 13, color: 'var(--v4-ink-50)', letterSpacing: '0.04em' }}
          >{ordinal}</span>
          <h3 className="text-[15px] font-semibold leading-tight text-[var(--v4-ink)] tracking-[-0.015em]">{title}</h3>
        </div>
        <p className="text-[12.5px] text-[var(--v4-ink-70)] leading-snug mb-2">{sub}</p>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--v4-ink)]">
          {cta}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    </Link>
  );
}
