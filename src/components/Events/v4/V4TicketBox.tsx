/**
 * V4TicketBox — side-box on event detail when an online ticket exists.
 *
 * Three visual variants:
 *   • ticket   (default)  — sand top-stripe, "Tickets verfügbar" badge
 *   • match               — gold stripe, "Du folgst <artist>" badge
 *   • lineup               — gold stripe, "<artist> im Line-up" badge
 *
 * All three share the same body: provider line, price block, primary CTA
 * ("Zu {provider}"), three secondary actions (Zum Plan / Merken / Teilen),
 * and the two brief-approved trust-copy strings at the bottom.
 *
 * Pure RSC. Ticket links open in a new tab with `rel="noopener noreferrer"`
 * — never lose the user to a partner shop in their main tab.
 */

import { V4Badge } from './V4Badge';
import {
  TRUST_COPY_EXTERNAL,
  TRUST_COPY_REDIRECT,
  providerLine,
} from '@/lib/v4/event-detail-trust-copy';

export type V4TicketBoxVariant = 'ticket' | 'match' | 'lineup';

interface V4TicketBoxProps {
  provider: string;
  priceFrom: string;
  ticketUrl: string;
  variant?: V4TicketBoxVariant;
  /** Required for `match`/`lineup` to personalise the badge label. */
  artistName?: string;
}

const STRIPE_COLOR: Record<V4TicketBoxVariant, string> = {
  ticket: 'var(--v4-ticket)',
  match:  'var(--v4-match)',
  lineup: 'var(--v4-match)',
};

const BORDER_COLOR: Record<V4TicketBoxVariant, string> = {
  ticket: 'rgba(212,184,150,0.34)',
  match:  'rgba(245,185,66,0.34)',
  lineup: 'rgba(245,185,66,0.34)',
};

function badgeLabel(variant: V4TicketBoxVariant, artistName?: string): string {
  if (variant === 'match' && artistName) return `Du folgst ${artistName}`;
  if (variant === 'lineup' && artistName) return `${artistName} im Line-up`;
  return 'Tickets verfügbar';
}

export function V4TicketBox({
  provider, priceFrom, ticketUrl,
  variant = 'ticket', artistName,
}: V4TicketBoxProps) {
  const badgeKind = variant === 'ticket' ? 'ticket' : variant;
  return (
    <div
      data-v4-side-box={variant}
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: `1px solid ${BORDER_COLOR[variant]}`, boxShadow: '0 6px 28px rgba(0,0,0,0.40)' }}
    >
      <div className="h-[3px]" style={{ background: STRIPE_COLOR[variant] }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind={badgeKind}>{badgeLabel(variant, artistName)}</V4Badge>

        <p className="mt-3.5 mb-1 text-[12px] font-medium text-[var(--v4-ink-70)]">
          {providerLine(provider)}
        </p>

        <div className="flex items-baseline gap-2.5 mb-4">
          <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--v4-ink-50)]">ab</span>
          <span className="text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)]">{priceFrom.replace(/^ab\s*/i, '')}</span>
          <span className="text-[12px] text-[var(--v4-ink-50)] ml-1">pro Person</span>
        </div>

        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-track="ticket_click"
          className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ticket)] text-[#1a1208] text-sm font-semibold"
        >
          Zu {provider}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <div className="mt-2.5 flex gap-2">
          <a href="/saved" className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            Zum Plan
          </a>
          <a href="/saved" className="press-haptic inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]" aria-label="Merken">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </a>
          <a href="#share" className="press-haptic inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]" aria-label="Teilen">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </a>
        </div>

        <div className="mt-4 pt-3.5 border-t border-[var(--v4-hairline-1)] flex flex-col gap-1.5">
          <p className="text-[11.5px] leading-[1.5] text-[var(--v4-ink-50)] flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v4-go)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0,marginTop:2}}><polyline points="20 6 9 17 4 12"/></svg>
            <span>{TRUST_COPY_EXTERNAL}</span>
          </p>
          <p className="text-[11.5px] leading-[1.5] text-[var(--v4-ink-50)] flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v4-go)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0,marginTop:2}}><polyline points="20 6 9 17 4 12"/></svg>
            <span>{TRUST_COPY_REDIRECT}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
