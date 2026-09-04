/**
 * "Weitere Ausflugsziele (OpenStreetMap)" — Gemeinde-Hub-Sektion fuer den
 * OSM-Freizeit-POI-Bestand (fn-18 Task 7).
 *
 * ── ODbL / Trennung ────────────────────────────────────────────────────────
 *   * EIGENE Sektion, getrennt von "Freizeit & Ausfluege" (poi_activities).
 *     Beide Bestaende werden nebeneinander gerendert, NIE ineinander
 *     gerechnet — kein Cross-Dedup, kein Merge (Begruendung im Header von
 *     supabase/migrations/20260727090000_osm_pois.sql).
 *   * Jeder Eintrag traegt einen sichtbaren Quellen-Badge ("OSM").
 *   * Attribution "(c) OpenStreetMap contributors" + ODbL-Link direkt an der
 *     Sektion (zusaetzlich zum Eintrag auf /quellen).
 *   * KEINE eigenen Detailseiten und keine internen Links: Eintraege sind
 *     reine Text-Kacheln (Thin-Content-Vermeidung, kleiner
 *     ODbL-Herausgabe-Umfang). Nur eine vom Betreiber im OSM-Objekt
 *     hinterlegte `website` wird als externer Link ausgegeben.
 *
 * fn-17: zweisprachig. Die Gemeinde-Page setzt inzwischen setRequestLocale,
 * getTranslations bleibt damit im statischen ISR-Pass (die alte Warnung an
 * dieser Stelle galt fuer die Zeit davor).
 */

import { getLocale, getTranslations } from 'next-intl/server';
import { Link as LocaleLink } from '@/i18n/navigation';
import { osmCategoryLabel } from '@/lib/osm/poi-whitelist';
import type { NearbyOsmPoi } from '@/lib/osm/nearby-pois';

/** Unter dieser Anzahl lohnt die Sektion nicht (wie MIN_HUB_ACTIVITIES). */
export const MIN_HUB_OSM_POIS = 3;

/** Maximal gerenderte Kacheln — der Rest bleibt Zahl in der Copy. */
const OSM_TILE_LIMIT = 30;

export async function GemeindeOsmPoisSection({
  pois,
  gemeindeName,
}: {
  pois: NearbyOsmPoi[];
  gemeindeName: string;
}) {
  if (pois.length < MIN_HUB_OSM_POIS) return null;

  const [t, locale] = await Promise.all([getTranslations('GemeindeHub'), getLocale()]);
  const shown = pois.slice(0, OSM_TILE_LIMIT);

  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-3">{t('osmTitle')}</h2>
      <p className="text-sm text-white/50 mb-4">
        {t('osmLead', { count: pois.length, name: gemeindeName })}
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {shown.map((p) => (
          <li
            key={p.id}
            className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-snug line-clamp-2">
                  {p.website ? (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="hover:text-blue-400 transition-colors"
                    >
                      {p.name}
                      <span className="inline-block ml-1 opacity-40">↗</span>
                    </a>
                  ) : (
                    p.name
                  )}
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  {osmCategoryLabel(p.category, locale)}
                  {` · ${p._distance_km.toFixed(1)} km`}
                </div>
              </div>
              {/* Quellen-Badge pro Eintrag (Task-Acceptance). */}
              <span
                className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/50"
                title={t('osmSourceTitle')}
              >
                OSM
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-white/35 mt-3 leading-relaxed">
        {t('osmAttributionPrefix')}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-white/60"
        >
          OpenStreetMap contributors
        </a>
        {t('osmAttributionMiddle')}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-white/60"
        >
          ODbL 1.0
        </a>
        {t('osmAttributionSuffix')}
        {/* LocaleLink: /en/gemeinde/* muss auf /en/quellen zeigen. */}
        <LocaleLink href="/quellen" className="underline underline-offset-2 hover:text-white/60">
          {t('osmSourcesLink')}
        </LocaleLink>
        .
      </p>
    </section>
  );
}
