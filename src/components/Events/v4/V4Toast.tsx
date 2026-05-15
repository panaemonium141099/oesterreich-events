'use client';

/**
 * V4Toast — small floating notification atom used by Phase 4 (post-follow
 * confirmation) and Phase 5 (plan-saved). Auto-dismisses after `duration`
 * ms unless duration is 0 (sticky).
 *
 * Renders inline at its mount point — no portal. Callers typically mount
 * it at floating absolute positions (bottom-right etc.).
 */

import { useEffect } from 'react';

export type V4ToastKind = 'match' | 'success' | 'info';

interface V4ToastProps {
  kind?: V4ToastKind;
  children: React.ReactNode;
  /** Auto-dismiss after N ms. 0 = sticky. Default 6000. */
  duration?: number;
  onDismiss?: () => void;
}

const ACCENT: Record<V4ToastKind, { fg: string; bd: string; bg: string }> = {
  match:   { fg: 'var(--v4-match)', bd: 'rgba(245,185,66,0.34)', bg: 'rgba(245,185,66,0.12)' },
  success: { fg: 'var(--v4-go)',    bd: 'rgba(123,183,148,0.34)', bg: 'rgba(123,183,148,0.12)' },
  info:    { fg: '#7eaaf0',         bd: 'rgba(126,170,240,0.34)', bg: 'rgba(126,170,240,0.12)' },
};

export function V4Toast({ kind = 'match', children, duration = 6000, onDismiss }: V4ToastProps) {
  useEffect(() => {
    if (duration === 0 || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  const a = ACCENT[kind];
  return (
    <div
      data-v4-toast
      data-kind={kind}
      role="status"
      className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur"
      style={{ background: a.bg, border: `1px solid ${a.bd}`, color: 'var(--v4-ink)' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${a.fg.startsWith('var') ? 'transparent' : a.fg}22`, color: a.fg, border: `1px solid ${a.bd}` }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div className="flex-1 min-w-0 text-[13px] leading-snug max-w-[420px]">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Schließen"
          className="press-haptic flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}
