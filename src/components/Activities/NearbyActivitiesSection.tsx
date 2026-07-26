/**
 * Aktivitaeten-Cross-Link-Sektionen (fn-18 Task 4) — beide Flaechen, die
 * auf /aktivitaet/* verlinken:
 *
 *   - GemeindeActivitiesSection: "Freizeit & Ausfluege" auf dem
 *     Gemeinde-Hub. Bekommt die Aktivitaeten als Prop — die Page laedt
 *     sie ohnehin fuer Metadata/Gate/JSON-LD ueber den EINEN
 *     unstable_cache-Loader (nearby-loaders.ts); ein Self-Load hier
 *     waere ein zweiter Cache-Zugriff ohne Mehrwert. Deutsch hartkodiert
 *     wie die restliche Hub-Seite — die Page setzt KEIN
 *     setRequestLocale, ein getTranslations-Aufruf wuerde den ISR-Pass
 *     auf dynamic kippen (Muster-Warnung in aktivitaet/[slug]/page.tsx).
 *
 *   - EventNearbyActivities: "In der Naehe erleben" unter dem
 *     Event-Detail (max 3 Aktivitaeten, <= 10 km). Laedt selbst ueber
 *     denselben Cache-Loader; Labels via next-intl (die Event-Seite
 *     setzt setRequestLocale).
 *
 * Karten sind Snippet-Cards — Quellen-/Bild-Attribution lebt auf der
 * Aktivitaets-Detailseite (Snippet-Ausnahme, siehe Projekt-Memory).
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Link as LocaleLink } from '@/i18n/navigation';
import { renderableImageUrls } from '@/lib/activities/indexability';
import { activityTagLabel, deriveActivityChips } from '@/lib/activities/tag-labels';
import {
  loadNearbyActivitiesCached,
  type NearbyActivity,
} from '@/lib/activities/nearby-loaders';

/** Hub-Sektion rendert erst ab so vielen Aktivitaeten (Task-Acceptance). */
export const MIN_HUB_ACTIVITIES = 3;

/** Event-Detail: max. Karten + Radius (Task-Spec: 3 Stueck, <= 10 km). */
const EVENT_DETAIL_LIMIT = 3;
const EVENT_DETAIL_RADIUS_KM = 10;

/** Hub zeigt maximal so viele Karten (Rest bleibt Zahl in der Copy). */
const HUB_CARD_LIMIT = 12;

function firstImageUrl(images: unknown): string | null {
  const urls = renderableImageUrls(images);
  return urls.length > 0 ? urls[0] : null;
}

function distanceLabel(km: number): string {
  return `${km.toFixed(1)} km`;
}

// ───────────────────────────────────────────────────────────────────────
// Gemeinde-Hub: "Freizeit & Ausfluege"
// ───────────────────────────────────────────────────────────────────────

export function GemeindeActivitiesSection({
  activities,
  gemeindeName,
}: {
  activities: NearbyActivity[];
  gemeindeName: string;
}) {
  if (activities.length < MIN_HUB_ACTIVITIES) return null;

  const chips = deriveActivityChips(activities);
  const shown = activities.slice(0, HUB_CARD_LIMIT);

  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-3">Freizeit &amp; Ausflüge</h2>
      <p className="text-sm text-white/50 mb-4">
        {activities.length} Freizeitaktivitäten und Ausflugsziele rund um{' '}
        {gemeindeName} — dauerhaft verfügbar, unabhängig vom Event-Kalender.
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((a) => {
          const img = firstImageUrl(a.images);
          return (
            <Link
              key={a.id}
              href={`/aktivitaet/${a.slug}`}
              className="rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors block"
            >
              <div className="relative w-full aspect-[4/3] bg-white/5">
                {img ? (
                  /* Remote-POI-Domains sind nicht im next/image-Allowlist —
                     plain img wie in V4RelatedEvents. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={img}
                    alt={a.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.12em] font-bold text-white/60 text-center px-3 leading-tight">
                    {a.tags?.[0] ? activityTagLabel(a.tags[0]) : 'Freizeit & Ausflug'}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="font-semibold leading-snug line-clamp-2 mb-1">{a.name}</div>
                <div className="text-xs text-white/50">
                  {a.town ?? gemeindeName}
                  {` · ${distanceLabel(a._distance_km)}`}
                </div>
                {a.price_hint && (
                  <div className="text-xs text-white/40 mt-1 line-clamp-1">{a.price_hint}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Event-Detail: "In der Naehe erleben"
// ───────────────────────────────────────────────────────────────────────

export async function EventNearbyActivities({ lat, lng }: { lat: number; lng: number }) {
  const [activities, t] = await Promise.all([
    loadNearbyActivitiesCached(lat, lng, EVENT_DETAIL_RADIUS_KM),
    getTranslations('Activity'),
  ]);
  const shown = activities.slice(0, EVENT_DETAIL_LIMIT);
  if (shown.length === 0) return null;

  return (
    <section className="bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-10 md:pb-14">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          {t('nearbyActivitiesEyebrow')}
        </p>
        <h2 className="text-[22px] md:text-[26px] font-bold leading-tight tracking-[-0.025em] mb-6">
          {t('nearbyActivitiesTitle')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((a) => {
            const img = firstImageUrl(a.images);
            return (
              <LocaleLink
                key={a.id}
                href={`/aktivitaet/${a.slug}`}
                className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
              >
                <div
                  className="w-full aspect-[16/9] relative overflow-hidden"
                  style={img ? undefined : { background: 'linear-gradient(135deg, #22c55e, #15803d)' }}
                >
                  {img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.12em] font-bold text-white/90 text-center px-3 leading-tight">
                      {a.tags?.[0] ? activityTagLabel(a.tags[0]) : t('nearbyActivitiesEyebrow')}
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-1.5">
                  <h3 className="text-[15px] font-semibold leading-tight line-clamp-2">{a.name}</h3>
                  <p className="text-[12.5px] text-[var(--v4-ink-70)] line-clamp-1">
                    {a.town ? `${a.town} · ` : ''}
                    {distanceLabel(a._distance_km)}
                  </p>
                </div>
              </LocaleLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
