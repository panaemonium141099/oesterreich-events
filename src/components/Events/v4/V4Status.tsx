'use client';

/**
 * V4Status — Status-Badge mit Icon + Label.
 *
 * Designer-Regel (a11y): nie nur Farbe, immer Icon + Label.
 *
 * Verwendet in:
 *  - Plan-Card (boarding-pass-Stil) auf /saved
 *  - Wizard-Step 04 "Übersicht" (Status-Rows)
 *  - Plan-Detail Status-Rows
 */

export type V4StatusKind = 'done' | 'open' | 'plan' | 'skip' | 'later' | 'match' | 'soldout';

interface V4StatusProps {
  kind: V4StatusKind;
  label: string;
}

interface StatusStyle {
  icon: 'check' | 'clock' | 'ticket' | 'x' | 'music' | 'bell';
  /** CSS-Var-Name für die Akzentfarbe (Text + Icon). */
  color: string;
  /** CSS-Var-Name für den Background. */
  bg: string;
}

const STYLES: Record<V4StatusKind, StatusStyle> = {
  done:    { icon: 'check',  color: 'var(--v4-go)',    bg: 'var(--v4-go-soft, rgba(74,222,128,0.12))' },
  open:    { icon: 'clock',  color: 'var(--v4-ink-50)', bg: 'var(--v4-hairline-2)' },
  plan:    { icon: 'ticket', color: 'var(--v4-ticket)', bg: 'var(--v4-ticket-soft, rgba(245,158,11,0.12))' },
  skip:    { icon: 'x',      color: 'var(--v4-ink-50)', bg: 'var(--v4-hairline-2)' },
  later:   { icon: 'clock',  color: 'var(--v4-ink-70)', bg: 'var(--v4-hairline-2)' },
  match:   { icon: 'music',  color: 'var(--v4-match)',  bg: 'var(--v4-match-soft, rgba(168,85,247,0.12))' },
  soldout: { icon: 'x',      color: 'var(--v4-alert)',  bg: 'var(--v4-alert-soft, rgba(239,68,68,0.12))' },
};

function StatusIcon({ name }: { name: StatusStyle['icon'] }) {
  // Lucide-style minimal inline icons (no external dependency).
  const props = {
    width: 12,
    height: 12,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'check':
      return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'ticket':
      return <svg {...props}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="13" y1="5" x2="13" y2="19"/></svg>;
    case 'x':
      return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'music':
      return <svg {...props}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    case 'bell':
      return <svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  }
}

export function V4Status({ kind, label }: V4StatusProps) {
  const s = STYLES[kind];
  return (
    <span
      data-status-kind={kind}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      <StatusIcon name={s.icon}/>
      {label}
    </span>
  );
}
