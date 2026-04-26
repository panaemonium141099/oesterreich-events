'use client';
/**
 * Notification-click navigation helper.
 *
 * Notifications can carry legacy UUID-form event URLs (`/events/<uuid>`)
 * left over from before we switched the source code to canonical
 * `/events/{plz-ort}/{date}/{slug}` URLs. Those legacy URLs still
 * work — the server's `/events/[...slug]/page.tsx` 308-redirects them
 * to the canonical form — but **only on full HTTP navigation**.
 *
 * If we use `router.push()` on a legacy URL, Next.js does an RSC fetch.
 * Its handling of 308 redirects from RSC fetches is unreliable: the
 * user sees "This page couldn't load" Chrome error and has to hit
 * Reload, then the canonical page appears.
 *
 * Defense: detect the legacy UUID shape and use a hard navigation
 * (`window.location.href`) instead of router.push. Browser follows
 * the Location header from the 308 cleanly. New canonical-form URLs
 * keep using `router.push()` for the fast soft-nav.
 *
 * Once all notifications.action_url rows are backfilled to canonical
 * URLs, this helper becomes a no-op. Until then it's the safety net.
 */

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const LEGACY_UUID_EVENT_URL = /^\/events\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

export function navigateFromNotification(url: string, router: AppRouterInstance): void {
  if (LEGACY_UUID_EVENT_URL.test(url) && typeof window !== 'undefined') {
    window.location.href = url;
    return;
  }
  router.push(url);
}
