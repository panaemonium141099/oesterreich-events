'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Client hook that wraps the Web-Push subscription lifecycle.
 *
 * Mobile-only users get a no-op — the user asked specifically for "PC only"
 * since mobile browsers will later have their own native path (PWA / TWA).
 */

type Status =
  | 'unsupported'       // SW/Push API not available, or mobile device
  | 'denied'            // user permanently blocked
  | 'default'           // supported, not yet granted
  | 'enabled'           // granted + active subscription
  | 'error'             // network/server/VAPID problem
  | 'loading';          // running through the flow

export interface UsePushNotifications {
  status: Status;
  errorMessage: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

const LOCAL_STORAGE_PROMPTED = 'push-prompted-v1';

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(ua)) return true;
  // Also guard against narrow tablets (user asked PC-only).
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return true;
  return false;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Returns current state + imperative handlers. The hook does NOT auto-subscribe;
 * the user has to click an "Aktivieren"-Button somewhere (browsers require the
 * request to be tied to a user gesture anyway).
 */
export function usePushNotifications(): UsePushNotifications {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute the initial status once the component mounts.
  useEffect(() => {
    let cancelled = false;
    const detect = async () => {
      if (typeof window === 'undefined') return;

      if (isMobile() || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setStatus('unsupported');
        return;
      }

      const perm = Notification.permission;
      if (perm === 'denied') { if (!cancelled) setStatus('denied'); return; }

      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const existing = await reg?.pushManager.getSubscription();
        if (perm === 'granted' && existing) {
          if (!cancelled) setStatus('enabled');
        } else {
          if (!cancelled) setStatus('default');
        }
      } catch {
        if (!cancelled) setStatus('default');
      }
    };
    detect();
    return () => { cancelled = true; };
  }, []);

  const enable = useCallback(async () => {
    setErrorMessage(null);
    setStatus('loading');

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setStatus('error');
      setErrorMessage('VAPID-Public-Key fehlt (server nicht konfiguriert)');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'default');
        return;
      }

      // Reuse if we already have a subscription.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // TS lib.dom types require BufferSource; Uint8Array is one, but the buffer
        // narrowing got stricter in recent TS versions — cast to satisfy.
        const appKey = urlBase64ToUint8Array(vapidKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appKey.buffer as ArrayBuffer,
        });
      }

      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'unknown' }));
        throw new Error(error || 'subscribe_failed');
      }

      try { localStorage.setItem(LOCAL_STORAGE_PROMPTED, '1'); } catch {}
      setStatus('enabled');
    } catch (err: unknown) {
      console.error('[push] enable failed', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }, []);

  const disable = useCallback(async () => {
    setErrorMessage(null);
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('default');
    } catch (err: unknown) {
      console.error('[push] disable failed', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }, []);

  return { status, errorMessage, enable, disable };
}
