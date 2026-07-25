/**
 * Slot-Contract fuer fn-18 Task 4 (VERBINDLICH, Task-3-Spec):
 *
 * Die Detailseite (src/app/[locale]/aktivitaet/[slug]/page.tsx) rendert
 * diese benannte Komponente an fixer Position unterhalb der Karte.
 * In Task 3 ist sie bewusst LEER; Task 4 implementiert hier den Inhalt
 * ("Events in der Naehe" + Cross-Links) und fasst page.tsx NICHT an —
 * Props duerfen dabei nur ergaenzt werden, wenn page.tsx unveraendert
 * kompiliert (activity traegt bereits alles Noetige: id, lat/lng,
 * gemeinde_slug, bundesland, tags).
 */

import type { PublicActivity } from '@/lib/activities/public-types';

interface ActivityExtrasSlotProps {
  activity: PublicActivity;
}

export function ActivityExtrasSlot(_props: ActivityExtrasSlotProps) {
  return null;
}
