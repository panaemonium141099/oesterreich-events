'use client';

/**
 * Tiny client island — fires one keepalive fetch to
 * /api/seo/experiment-impression on mount so we have a first-party
 * tally of variant × path × timestamp.
 *
 * Designed to be zero-weight: no render output, no libraries, fires
 * once per mount and never re-renders. Swallows errors silently —
 * missing impression logs are a minor accuracy issue, not a user-
 * facing break.
 */

import { useEffect, useRef } from 'react';

interface Props {
  experimentId: string;
  variant: 'A' | 'B';
  /** The hub path the impression belongs to. Pass the canonical path
   *  (e.g. "/gemeinde/7000-eisenstadt"), NOT a full URL — the API
   *  truncates at 200 chars anyway. */
  path: string;
}

export function ExperimentImpressionLogger({ experimentId, variant, path }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // `keepalive: true` lets the request complete even if the user
    // navigates away immediately — standard pattern for analytics-ish
    // beacons where we'd rather lose some accuracy than block nav.
    void fetch('/api/seo/experiment-impression', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experimentId, variant, path }),
    }).catch(() => {
      // Silent — see file docstring.
    });
  }, [experimentId, variant, path]);

  return null;
}
