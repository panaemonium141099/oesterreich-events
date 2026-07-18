import { redirect } from 'next/navigation';

/**
 * /plans — Phase 1 stub. The "Meine Pläne" tab in V4TopNav / V4TabBar
 * links here so the route is functional, but the real Plans page (which
 * consolidates /saved + /groups into a unified plan list with Plan-Wizard
 * deep-links) ships in Phase 5 of the v4 redesign.
 *
 * Until then, redirect to the existing /saved page so users always land
 * on something meaningful when they tap the tab.
 */
export default function PlansStubPage(): never {
  redirect('/saved');
}
