'use client';

/**
 * V4SearchInput — controlled search field used on the landing hero AND
 * in the global top-nav. Submitting (Enter or icon-click) navigates to
 *
 *     /entdecken?search=<query>
 *
 * which `useFilteredEvents` consumes as a free-text filter on the list
 * mode. Empty / whitespace-only queries are no-ops so an accidental
 * Enter doesn't strip an existing filter.
 *
 * Two visual variants are baked in: a tall pill ("hero") with a search
 * icon on the left, and a compact pill ("nav") with an extra ⌘K kbd
 * hint on the right. Everything else is shared.
 */

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface V4SearchInputProps {
  variant: 'hero' | 'nav';
  placeholder?: string;
  /** Forwarded to the input — useful on the landing hero where typing
   *  should start without an extra click. Always false in the top-nav. */
  autoFocus?: boolean;
  /** Optional override for the destination route. Default '/entdecken'. */
  destination?: string;
  className?: string;
}

export function V4SearchInput({
  variant,
  placeholder = 'Künstler, Event oder Ort suchen …',
  autoFocus = false,
  destination = '/entdecken',
  className,
}: V4SearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`${destination}?search=${encodeURIComponent(q)}`);
  }

  if (variant === 'nav') {
    return (
      <form
        onSubmit={onSubmit}
        role="search"
        aria-label="Künstler, Event oder Ort suchen"
        className={
          'hidden lg:inline-flex items-center gap-2 min-w-[260px] px-3 py-2 rounded-full border border-[var(--v4-hairline-2)] focus-within:border-[var(--v4-hairline-3)] transition-colors ' +
          (className ?? '')
        }
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--v4-ink-50)]">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          name="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-0 outline-none text-[13px] text-[var(--v4-ink)] placeholder-[var(--v4-ink-50)] min-w-0"
        />
        <kbd className="px-1.5 py-px text-[10px] rounded border border-[var(--v4-hairline-2)] text-[var(--v4-ink-30)] flex-shrink-0">
          ⌘ K
        </kbd>
      </form>
    );
  }

  // hero variant
  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="Künstler, Event oder Ort suchen"
      className={
        'flex items-center gap-3 px-5 py-3.5 rounded-full border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] focus-within:border-[var(--v4-hairline-3)] transition-colors w-full md:w-auto md:min-w-[420px] ' +
        (className ?? '')
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--v4-ink-50)] flex-shrink-0">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        name="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 bg-transparent border-0 outline-none text-sm text-[var(--v4-ink)] placeholder-[var(--v4-ink-50)] min-w-0"
      />
      <button
        type="submit"
        disabled={!query.trim()}
        aria-label="Suchen"
        className="press-haptic flex-shrink-0 inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Suchen
      </button>
    </form>
  );
}
