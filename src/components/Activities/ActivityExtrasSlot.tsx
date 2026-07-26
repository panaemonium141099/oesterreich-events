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
import { NearbyEventsSection } from './NearbyEventsSection';

interface ActivityExtrasSlotProps {
  activity: PublicActivity;
}

export function ActivityExtrasSlot({ activity }: ActivityExtrasSlotProps) {
  return <NearbyEventsSection lat={activity.lat} lng={activity.lng} />;
}
