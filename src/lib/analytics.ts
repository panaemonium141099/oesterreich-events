/**
 * Client-side analytics tracking.
 * Fire-and-forget — never blocks the UI.
 */

export function trackEvent(type: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  const sessionId = getOrCreateSessionId();

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      data,
      page: window.location.pathname,
      referrer: document.referrer || undefined,
    }),
    keepalive: true, // survives page navigation
  }).catch(() => {
    // never fail — analytics should not impact UX
  });
}

function getOrCreateSessionId(): string {
  try {
    let id = sessionStorage.getItem('analytics_session_id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('analytics_session_id', id);
    }
    return id;
  } catch {
    // SSR or private browsing fallback
    return 'unknown';
  }
}
