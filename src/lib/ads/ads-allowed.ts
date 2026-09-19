'use client';

/**
 * Werbefreie Accounts (2026-09-19).
 *
 * Entscheidet im Browser, ob AdSense fuer den aktuellen Besucher ueberhaupt
 * geladen werden darf. Hintergrund: AdSense hat die Einnahmen wegen
 * ungueltiger Klicks eingeschraenkt; Admins schalten deshalb einzelne
 * Accounts unter /admin/users werbefrei (profiles.ads_disabled).
 *
 * Warum nicht ueber useAuth(): Der AuthProvider haengt seit fn-15.5 nur an
 * eingeloggten Routen, die Anzeigen liegen aber auch auf Blog und
 * Aktivitaeten (anonyme Routen ohne Provider). Deshalb dieselbe Heuristik
 * wie Middleware und PersonalizedMatches:
 *
 *   - Kein sb-*-auth-token-Cookie  -> anonym, Anzeigen sofort erlaubt,
 *                                     KEIN Request (99 % des Traffics).
 *   - Cookie vorhanden             -> GET /api/me/ads entscheidet.
 *
 * Die Antwort wird pro Seitenladung einmal geholt (ein Promise fuer
 * AdSense-Script und alle Slots). Solange sie fehlt, laeuft nichts: fuer
 * werbefreie Accounts darf es keinen Moment mit sichtbarer Anzeige geben.
 * Fehler werden zugunsten des Kontos ausgelegt (keine Anzeige), nur ein
 * 401 gilt als „doch anonym".
 */

import { useEffect, useState } from 'react';

export interface MeAdsResponse {
  signedIn: boolean;
  adsDisabled: boolean;
}

export function hasSupabaseAuthCookie(): boolean {
  try {
    return document.cookie
      .split('; ')
      .some((c) => c.startsWith('sb-') && c.includes('auth-token'));
  } catch {
    return false;
  }
}

/**
 * Pure Auswertung der /api/me/ads-Antwort (getestet).
 *   401           -> Cookie da, aber keine gueltige Session: anonym, erlaubt.
 *   andere Fehler -> Konto schuetzen, keine Anzeige.
 *   200           -> erlaubt, solange adsDisabled nicht true ist.
 */
export function adsAllowedFromResponse(status: number, body: unknown): boolean {
  if (status === 401) return true;
  if (status < 200 || status >= 300) return false;
  if (!body || typeof body !== 'object') return false;
  return (body as Partial<MeAdsResponse>).adsDisabled !== true;
}

let pending: Promise<boolean> | null = null;

export function resolveAdsAllowed(): Promise<boolean> {
  if (!pending) {
    pending = (async () => {
      if (typeof document === 'undefined') return false;
      if (!hasSupabaseAuthCookie()) return true;
      try {
        const res = await fetch('/api/me/ads', { credentials: 'same-origin', cache: 'no-store' });
        const body = res.status === 401 ? null : await res.json().catch(() => null);
        return adsAllowedFromResponse(res.status, body);
      } catch {
        return false;
      }
    })();
  }
  return pending;
}

/** Nach dem Umschalten des eigenen Accounts im Adminbereich: neu entscheiden. */
export function resetAdsAllowed(): void {
  pending = null;
}

/** null = noch unentschieden (Server-Render, erster Client-Render, Request offen). */
export function useAdsAllowed(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    resolveAdsAllowed().then((value) => {
      if (mounted) setAllowed(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return allowed;
}
