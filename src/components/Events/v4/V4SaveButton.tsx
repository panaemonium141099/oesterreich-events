'use client';

/**
 * V4SaveButton — pill-shaped "Merken / Gemerkt" toggle for V4 side-boxes.
 *
 * Replaces the legacy `<a href="/saved">Merken</a>` shortcuts that lived in
 * V4FreeBox / V4TicketBox / V4DoorsaleBox / V4UnknownBox / V4MobileStickyBar.
 * Those were nominal "save" affordances that did the opposite of save — they
 * just navigated to /saved without ever touching the saved_events table.
 *
 * Behaviour:
 *   - Mount: optimistic GET against saved_events to set initial state
 *   - Click while signed-out: redirect to /auth/login?next=<current-path>
 *   - Click while signed-in: optimistic toggle + insert/delete in saved_events
 *   - Success: small pulse + label flips Merken ↔ Gemerkt
 *   - Failure: revert state, sonner toast
 *
 * Visual states — match the rust/cream brand palette via existing CSS vars:
 *   not-saved  → outline bookmark icon, hairline border, ink-50 fill
 *   saved      → filled bookmark icon, rust border + tint, ink fill
 *   loading    → opacity 50, no clicks
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { toast } from 'sonner';

interface V4SaveButtonProps {
  eventId: string;
  /** When true: stretches to fill its grid column (Free/Doorsale row layout).
   *  When false: compact pill (Ticket/Unknown three-up row). Default false. */
  fillRow?: boolean;
  /** Show the text label next to the icon. Default true; pass false in
   *  ultra-tight slots that only fit the icon. */
  withLabel?: boolean;
}

export function V4SaveButton({ eventId, fillRow = false, withLabel = true }: V4SaveButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false); // brief visual flash after a successful save

  // Hydrate initial state from DB once we know the user.
  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    let alive = true;
    supabase
      .from('saved_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => { if (alive) setSaved(!!data); });
    return () => { alive = false; };
  }, [user, eventId, supabase]);

  const handleClick = useCallback(async () => {
    if (loading) return;
    if (!user) {
      const next = pathname ?? '/';
      router.push(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    // Optimistic flip so the user sees instant feedback.
    const wasSaved = saved;
    setSaved(!wasSaved);
    setLoading(true);

    try {
      if (wasSaved) {
        await supabase
          .from('saved_events')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eventId);
        toast.success('Aus „Gemerkt" entfernt');
      } else {
        await supabase
          .from('saved_events')
          .insert({ user_id: user.id, event_id: eventId });
        toast.success('Event gemerkt — findest du unter „Gespeicherte Events"');
        // Pulse animation only on the positive action.
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
    } catch (err) {
      // Revert optimistic state.
      setSaved(wasSaved);
      toast.error('Konnte gerade nicht gespeichert werden');
      console.error('[V4SaveButton] toggle failed', err);
    } finally {
      setLoading(false);
    }
  }, [user, saved, loading, pathname, router, supabase, eventId]);

  const baseClasses = [
    'press-haptic',
    'inline-flex items-center justify-center gap-1.5',
    'px-3 py-2 rounded-full',
    'text-[12.5px] font-semibold',
    'border transition-all duration-200',
    fillRow ? 'flex-1' : '',
    loading ? 'opacity-60 pointer-events-none' : '',
    pulse ? 'scale-[1.06]' : '',
  ].filter(Boolean).join(' ');

  // Brand-aligned style switch instead of arbitrary new colors. Saved uses
  // a soft rust-tinted surface + the brand accent for the icon stroke fill,
  // not-saved is a neutral hairline pill matching its siblings.
  const style = saved
    ? {
        background: 'rgba(200, 85, 61, 0.10)', // BRAND.accent at 10%
        borderColor: 'rgba(200, 85, 61, 0.55)',
        color: '#c8553d',
      }
    : {
        borderColor: 'var(--v4-hairline-3)',
        color: 'var(--v4-ink)',
      };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? 'Aus Gemerkt entfernen' : 'Event merken'}
      className={baseClasses}
      style={style}
    >
      <svg
        width="12" height="12" viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {withLabel && (saved ? 'Gemerkt' : 'Merken')}
    </button>
  );
}
