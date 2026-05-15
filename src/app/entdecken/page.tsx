'use client';

/**
 * /entdecken — Dual-mode discovery page (Phase 4).
 *
 * Mode is persisted in the URL via ?mode=filter|smart. First visit
 * default = filter. Filter mode owns chips (?chip=) and sort (?sort=).
 * Smart mode owns the query (?q=).
 */

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  V4EntdeckenHero,
  V4EntdeckenFilterMode,
  V4EntdeckenSmartMode,
} from '@/components/Discover/v4';
import { type V4EntdeckenMode, type V4SortKey } from '@/components/Events/v4';

function EntdeckenInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<V4EntdeckenMode>(
    (search.get('mode') === 'smart' ? 'smart' : 'filter')
  );
  const [chips, setChips] = useState<Set<string>>(
    new Set(((search.get('chip') ?? '').split(',').filter(Boolean)))
  );
  const [sort, setSort] = useState<V4SortKey>(
    (search.get('sort') as V4SortKey) ?? 'score'
  );
  const initialQuery = search.get('q') ?? '';

  // Mirror state back into URL for deep-link / share-link parity.
  useEffect(() => {
    const next = new URLSearchParams();
    next.set('mode', mode);
    if (mode === 'filter') {
      if (chips.size > 0) next.set('chip', Array.from(chips).join(','));
      if (sort !== 'score') next.set('sort', sort);
    } else if (initialQuery) {
      next.set('q', initialQuery);
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chips, sort]);

  const onChipsChange = useCallback((next: Set<string>) => { setChips(next); }, []);
  const onSortChange = useCallback((next: V4SortKey) => { setSort(next); }, []);
  const onModeChange = useCallback((next: V4EntdeckenMode) => { setMode(next); }, []);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4EntdeckenHero mode={mode} onModeChange={onModeChange}/>
      {mode === 'filter' ? (
        <V4EntdeckenFilterMode
          activeChips={chips}
          sort={sort}
          onChipsChange={onChipsChange}
          onSortChange={onSortChange}
        />
      ) : (
        <V4EntdeckenSmartMode initialQuery={initialQuery}/>
      )}
    </div>
  );
}

export default function EntdeckenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--v4-surface)]"/>}>
      <EntdeckenInner/>
    </Suspense>
  );
}
