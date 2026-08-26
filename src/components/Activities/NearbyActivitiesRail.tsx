'use client';

/**
 * "In deiner Nähe" — Standort-Highlights oben auf /aktivitaeten (fn-19).
 *
 * Verhalten:
 *  - Liegt bereits ein Standort im localStorage (user_location — geteilt
 *    mit Map/TrendingRow via lib/geolocation), laedt die Rail sofort.
 *  - Sonst zeigt sie einen "Standort verwenden"-Chip; erst der Klick
 *    loest den Browser-Permission-Prompt aus (nie beim Seitenaufruf).
 *  - Ablehnung/Fehler → Chip verschwindet fuer diese Session, die
 *    normale Score-Liste darunter bleibt unberuehrt.
 *
 * Cache-Hygiene: Koordinaten werden VOR dem Request auf 2 Dezimalstellen
 * gerundet (~1,1 km Raster) — CDN-Cache-Keys kollabieren aufs Gitter,
 * und der genaue GPS-Fix verlaesst den Browser nicht.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import { ActivityCardImage } from './ActivityCardImage';
import {
  getStoredLocation,
  markLocationAsked,
  requestGeolocation,
  storeLocation,
} from '@/lib/geolocation';

interface NearbyActivity {
  id: string;
  slug: string;
  name: string;
  tags: string[] | null;
  town: string | null;
  price_hint: string | null;
  images: unknown;
  distance_km: number;
}

function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

export function NearbyActivitiesRail() {
  const t = useTranslations('Activities');
  const [items, setItems] = useState<NearbyActivity[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'hidden'>('idle');

  const load = useCallback(async (lat: number, lng: number) => {
    setState('loading');
    try {
      const res = await fetch(
        `/api/activities/nearby?lat=${roundCoord(lat)}&lng=${roundCoord(lng)}&limit=8`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { activities?: NearbyActivity[] };
      if (body.activities && body.activities.length > 0) {
        setItems(body.activities);
        setState('ready');
      } else {
        setState('hidden');
      }
    } catch {
      // Zusatznutzen — bei Fehlern verschwindet die Sektion einfach.
      setState('hidden');
    }
  }, []);

  useEffect(() => {
    const stored = getStoredLocation();
    if (stored) void load(stored.lat, stored.lng);
  }, [load]);

  const onUseLocation = useCallback(async () => {
    markLocationAsked();
    setState('loading');
    const pos = await requestGeolocation();
    if (!pos) {
      setState('hidden');
      return;
    }
    storeLocation(pos.coords.latitude, pos.coords.longitude);
    void load(pos.coords.latitude, pos.coords.longitude);
  }, [load]);

  if (state === 'hidden') return null;

  if (state === 'idle') {
    return (
      <div className="mb-8">
        <button
          type="button"
          onClick={onUseLocation}
          data-track="activities_nearby_optin"
          className="press-haptic inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-sm font-semibold hover:bg-white/15 transition-colors"
        >
          📍 {t('nearbyCta')}
        </button>
      </div>
    );
  }

  return (
    <section className="mb-10" data-testid="nearby-activities">
      <h2 className="text-lg font-bold mb-1">📍 {t('nearbyTitle')}</h2>
      <p className="text-xs text-white/50 mb-4">{t('nearbyHint')}</p>
      {state === 'loading' ? (
        <p className="text-sm text-white/50 py-6">{t('loading')}</p>
      ) : (
        <div className="grid grid-flow-col auto-cols-[70%] sm:auto-cols-[45%] lg:auto-cols-[24%] gap-4 overflow-x-auto pb-2 snap-x">
          {(items ?? []).map((a) => (
            <LocaleLink
              key={a.id}
              href={`/aktivitaet/${a.slug}`}
              className="press-haptic rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors block snap-start"
              data-track="activities_nearby_card"
            >
              <ActivityCardImage
                images={a.images}
                alt={a.name}
                fallbackLabel={a.tags?.[0] ? activityTagLabel(a.tags[0]) : t('cardFallback')}
                creditPrefix={t('imageCredit')}
                aspectClass="aspect-[4/3]"
              />
              <div className="p-3">
                <div className="font-semibold leading-snug line-clamp-2 mb-1">{a.name}</div>
                <div className="text-xs text-white/50">
                  {a.distance_km.toLocaleString('de-AT')} km
                  {a.town ? ` · ${a.town}` : ''}
                </div>
              </div>
            </LocaleLink>
          ))}
        </div>
      )}
    </section>
  );
}
