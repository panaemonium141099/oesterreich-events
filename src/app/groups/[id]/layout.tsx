'use client';

/**
 * /groups/[id] — authenticated plan detail.
 *
 * fn-15.5 (round-2 codex fix): the parent `/groups/layout.tsx` already
 * mounts <AppShell>, so this layout MUST NOT wrap in another AppShell
 * (would create a double provider tree). Instead, it toggles a
 * `data-hide-social-nav` attribute on the document body for the
 * duration of the route — the global CSS rule
 * `body[data-hide-social-nav] [data-social-nav] { display: none }`
 * (in globals.css) hides the bottom-nav that the parent AppShell
 * renders as a sibling of `children`. A pure-CSS class on `children`
 * couldn't reach a sibling/ancestor; the body-attribute approach can.
 */

import { useEffect } from 'react';

export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.setAttribute('data-hide-social-nav', 'true');
    return () => { document.body.removeAttribute('data-hide-social-nav'); };
  }, []);
  return <>{children}</>;
}
