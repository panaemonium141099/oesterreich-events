/**
 * Slot-Contract fuer fn-18 Task 4 (VERBINDLICH, Task-3-Spec):
 *
 * Die Detailseite (src/app/[locale]/aktivitaet/[slug]/page.tsx) rendert
 * diese benannte Komponente an fixer Position unterhalb der Karte.
 * Task 4 fuellt den Slot mit "Events in der Naehe" (max 3 kommende
 * Events, <= 10 km) — page.tsx bleibt unveraendert, die Props sind
 * identisch zum Task-3-Contract (activity traegt lat/lng).
 */

import type { PublicActivity } from '@/lib/activities/public-types';
import { TourBox } from '@/components/Affiliate/TourBox';
import { NearbyEventsSection } from './NearbyEventsSection';

interface ActivityExtrasSlotProps {
  activity: PublicActivity;
}

export function ActivityExtrasSlot({ activity }: ActivityExtrasSlotProps) {
  return (
    <>
      <NearbyEventsSection lat={activity.lat} lng={activity.lng} />
      {/* fn-22 — buchbare Touren am Ort (GetYourGuide). Eigene Breite wie
          die Nachbar-Sektion, damit die Seite eine Spalte bleibt. */}
      <TourBox
        layout="inline"
        className="max-w-4xl mx-auto px-6 mt-10"
        city={activity.town}
        bundesland={activity.bundesland}
        placement={`aktivitaet-${activity.slug}`}
      />
    </>
  );
}
