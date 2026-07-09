'use client';

/**
 * PersonalizedMatches — Client-Personalisierung der statischen Landing (§10.2).
 *
 * Die Landing rendert für alle identisch aus dem ISR-Cache; dieser Baustein
 * ersetzt die frühere Server-Verzweigung `ctx.signedIn ? Matches : Teaser`:
 *
 *   1. First Paint: <AnonFollowTeaser/> — steht im statischen HTML, damit
 *      Googlebot & anonyme Besucher (99 % des Traffics) NIE warten.
 *   2. Nach Mount: Nur wenn ein sb-*-auth-token-Cookie sichtbar ist (gleiche
 *      Heuristik wie die Middleware) holen wir /api/me/landing und tauschen
 *      auf <MatchesSection/> um. Anonyme Besucher feuern KEINEN Request.
 *
 * Trade-off (bewusst): Eingeloggte sehen den Teaser für einen Wimpernschlag,
 * bevor die Matches erscheinen — der Preis dafür, dass die Seite für alle
 * instant aus dem Cache kommt statt >1s dynamisch zu rendern (vorher: 8
 * Roundtrips im Server-Render, Cache komplett umgangen).
 */

import { useEffect, useState } from 'react';
import { MatchesSection } from './MatchesSection';
import { AnonFollowTeaser } from './AnonFollowTeaser';
import type { ArtistAppearance } from '@/lib/artists/appearances';

function hasSupabaseAuthCookie(): boolean {
  try {
    return document.cookie.split('; ').some(
      c => c.startsWith('sb-') && c.includes('auth-token'),
    );
  } catch {
    return false;
  }
}

interface MeLandingResponse {
  signedIn: boolean;
  matches: ArtistAppearance[];
}

export function PersonalizedMatches() {
  const [matches, setMatches] = useState<ArtistAppearance[] | null>(null);

  useEffect(() => {
    if (!hasSupabaseAuthCookie()) return; // anonym → Teaser bleibt, 0 Requests

    const controller = new AbortController();
    fetch('/api/me/landing', { signal: controller.signal })
      .then(r => (r.ok ? (r.json() as Promise<MeLandingResponse>) : null))
      .then(data => {
        if (data?.signedIn) setMatches(data.matches);
      })
      .catch(() => {
        // Personalisierung ist Kür — bei Fehlern bleibt der Teaser stehen.
      });
    return () => controller.abort();
  }, []);

  return matches === null
    ? <AnonFollowTeaser/>
    : <MatchesSection appearances={matches}/>;
}
