/**
 * Freigabe eines Inserats: aus der eingereichten Zeile wird eine echte
 * `events`-Zeile.
 *
 * REIN — Koordinaten und Zeitpunkt werden hineingereicht, damit die
 * Zusammenstellung im Test ohne Netz und ohne DB prüfbar bleibt.
 *
 * Die vier Entscheidungen, die hier stecken:
 *
 *  1) `source_type = 'business' | 'user'` (nicht 'scraped'). Damit taucht
 *     ein freigegebenes Inserat in /admin/moderation auf, das genau nach
 *     diesen beiden Typen filtert.
 *
 *  2) `source_url` = die vom Inserenten angegebene Veranstaltungsseite,
 *     `source_name` = Firma/Person. Die Event-Detailseite MUSS eine Quelle
 *     ausweisen; bei einem Inserat ist der Veranstalter selbst die Quelle.
 *
 *  3) `quality_score` wird gesetzt, nicht offen gelassen. Der nächtliche
 *     Backfill (src/scripts/backfill-quality.ts) greift ausschliesslich
 *     Zeilen mit `quality_score IS NULL` — ein gesetzter Wert nimmt das
 *     Inserat dauerhaft aus dem automatischen Neu-Bewerten heraus und
 *     schützt die manuelle Freigabe davor, nachts überschrieben zu werden.
 *
 *  4) `publish_status = 'published'`. Die Freigabe ist die Entscheidung
 *     eines Menschen; sie sticht den additiven Qualitätsscore, der ein
 *     Inserat ohne Bild sonst auf 'needs_review' schieben würde.
 */

import { generateEventSlug } from '@/lib/utils/slugify';
import { scoreEvent } from '@/lib/quality/score-event';
import { getBundeslandFromPLZ } from '@/lib/plzCoordinates';
import { districtFromPlz } from '@/lib/plz-district';

/** Die Felder einer `event_submissions`-Zeile, die für die Freigabe zählen. */
export interface ApprovableSubmission {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  price_text: string | null;
  ticket_url: string | null;
  image_url: string | null;
  event_url: string | null;
  organizer: string | null;
  submitter_type: string;
  company: string | null;
  contact_name: string;
}

export interface ApproveOptions {
  /** Im Admin vor der Freigabe aufgelöste Koordinaten (Geocoding). */
  latitude?: number | null;
  longitude?: number | null;
  /** Referenzzeitpunkt für created_at/last_seen_at — im Test injizierbar. */
  now?: Date;
}

/**
 * Baut die `events`-Zeile für ein freigegebenes Inserat.
 *
 * Rückgabe ist bewusst ein loses Objekt und kein `Database['events']['Insert']`:
 * die Route schreibt es mit der Service-Role, und die Spaltenmenge der
 * events-Tabelle ist grösser als das Typ-Abbild in src/types/database.ts.
 */
export function buildEventRow(
  submission: ApprovableSubmission,
  options: ApproveOptions = {},
): Record<string, unknown> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  // Bundesland: Angabe des Inserenten schlägt die PLZ-Ableitung, weil er
  // seinen Veranstaltungsort kennt. Fehlt sie, springt die PLZ ein.
  const bundesland =
    submission.bundesland ??
    (submission.postal_code ? getBundeslandFromPLZ(submission.postal_code) : null);

  const latitude = options.latitude ?? null;
  const longitude = options.longitude ?? null;

  const scoreable = {
    title: submission.title,
    description: submission.description,
    start_date: submission.start_date,
    end_date: submission.end_date,
    location_name: submission.location_name,
    address: submission.address,
    postal_code: submission.postal_code,
    bundesland,
    country: 'AT',
    category: submission.category,
    latitude,
    longitude,
    image_url: submission.image_url,
    source_url: submission.event_url,
    ticket_url: submission.ticket_url,
  };

  // Der Score bleibt das Ranking-/Vollständigkeitssignal und wird ehrlich
  // berechnet. Nur die Freigabe (publish_status) kommt vom Menschen.
  const { quality_score } = scoreEvent(scoreable);

  return {
    source_type: submission.submitter_type === 'person' ? 'user' : 'business',
    source_name: submission.company ?? submission.contact_name,
    source_id: `inserat:${submission.id}`,
    source_url: submission.event_url,
    title: submission.title,
    description: submission.description,
    category: submission.category ?? 'Sonstiges',
    start_date: submission.start_date,
    end_date: submission.end_date,
    is_all_day: submission.is_all_day,
    location_name: submission.location_name,
    address: submission.address,
    postal_code: submission.postal_code,
    district: districtFromPlz(submission.postal_code, bundesland),
    bundesland,
    country: 'AT',
    latitude,
    longitude,
    image_url: submission.image_url,
    price_text: submission.price_text,
    ticket_url: submission.ticket_url,
    organizer: submission.organizer ?? submission.company ?? submission.contact_name,
    organizer_url: submission.event_url,
    visibility: 'public',
    quality_score,
    publish_status: 'published',
    slug: generateEventSlug(submission.title, submission.location_name),
    last_seen_at: nowIso,
  };
}
