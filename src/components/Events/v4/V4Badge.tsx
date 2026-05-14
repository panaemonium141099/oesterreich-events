/**
 * V4Badge — semantic state-badge atom used by all v4 cards.
 *
 * Nine kinds:
 *   ticket   sand    "Tickets verfügbar"  (online pre-sale exists)
 *   match    gold    "Du folgst diesem Artist"
 *   lineup   gold    "Artist im Line-up"  (festival has user's followed artist)
 *   free     green   "Eintritt frei"
 *   doorsale blue    "Abendkasse"         (price at door, no online sale)
 *   inplan   green   "In deinem Plan"     (user has saved this event)
 *   unknown  neutral "Kein Ticket bekannt"
 *   soldout  red     "Ausverkauft"
 *   today    blue    "Heute"
 *
 * Color is never the sole signal — every kind has an icon + label.
 * Stays RSC-safe (no 'use client'). Uses --v4-* tokens added in Phase 1.
 */

import type { ReactNode, SVGProps } from 'react';

export type V4BadgeKind =
  | 'ticket' | 'match' | 'lineup' | 'free'
  | 'doorsale' | 'inplan' | 'unknown' | 'soldout' | 'today';

interface V4BadgeProps {
  kind: V4BadgeKind;
  children: ReactNode;
}

const ICON_STROKE = 2.2;

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={ICON_STROKE}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

function IconTicket() { return <Icon><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></Icon>; }
function IconMusic()  { return <Icon><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Icon>; }
function IconStar()   { return <Icon><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Icon>; }
function IconCheck()  { return <Icon strokeWidth={2.4}><polyline points="20 6 9 17 4 12"/></Icon>; }
function IconCoffee() { return <Icon><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/></Icon>; }
function IconX()      { return <Icon strokeWidth={2.4}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>; }
function IconDot()    { return <span aria-hidden="true" style={{display:'inline-block', width:5, height:5, borderRadius:'50%', background:'currentColor'}}/>; }

interface KindStyle {
  bg: string;
  fg: string;
  bd: string;
  icon: ReactNode | null;
}

const KIND_STYLES: Record<V4BadgeKind, KindStyle> = {
  ticket:   { bg: 'rgba(212,184,150,0.14)', fg: 'var(--v4-ticket)', bd: 'rgba(212,184,150,0.34)', icon: <IconTicket/> },
  match:    { bg: 'rgba(245,185,66,0.14)',  fg: 'var(--v4-match)',  bd: 'rgba(245,185,66,0.34)',  icon: <IconMusic/> },
  lineup:   { bg: 'rgba(245,185,66,0.14)',  fg: 'var(--v4-match)',  bd: 'rgba(245,185,66,0.34)',  icon: <IconStar/> },
  free:     { bg: 'rgba(123,183,148,0.14)', fg: 'var(--v4-go)',     bd: 'rgba(123,183,148,0.34)', icon: <IconCheck/> },
  doorsale: { bg: 'rgba(126,170,240,0.14)', fg: '#7eaaf0',          bd: 'rgba(126,170,240,0.34)', icon: <IconCoffee/> },
  inplan:   { bg: 'rgba(123,183,148,0.14)', fg: 'var(--v4-go)',     bd: 'rgba(123,183,148,0.34)', icon: <IconCheck/> },
  soldout:  { bg: 'rgba(198,112,121,0.14)', fg: 'var(--v4-alert)',  bd: 'rgba(198,112,121,0.40)', icon: <IconX/> },
  today:    { bg: 'rgba(94,144,224,0.18)',  fg: '#7eaaf0',          bd: 'rgba(94,144,224,0.40)',  icon: <IconDot/> },
  unknown:  { bg: 'var(--v4-hairline-2)',   fg: 'var(--v4-ink-70)', bd: 'var(--v4-hairline-2)',   icon: null },
};

export function V4Badge({ kind, children }: V4BadgeProps) {
  const s = KIND_STYLES[kind];
  return (
    <span
      data-v4-badge
      data-kind={kind}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 9px 4px 8px', borderRadius: 9999,
        background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.005em',
        whiteSpace: 'nowrap',
      }}
    >
      {s.icon}{children}
    </span>
  );
}
