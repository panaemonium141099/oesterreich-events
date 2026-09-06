/**
 * Validierung + Normalisierung eines Event-Inserats.
 *
 * REIN — kein I/O, keine Umgebungsvariablen. Die API-Route
 * (src/app/api/events/inserat/route.ts) macht nur noch Transport,
 * Rate-Limit und Persistenz; alles Fachliche steht hier und ist im
 * Unit-Test ohne DB prüfbar.
 *
 * Zwei Punkte, die man leicht falsch macht und die hier bewusst gelöst sind:
 *
 *  1) ZEITZONE. Das Formular liefert Wiener Ortszeit ("2026-09-20", "19:30").
 *     Ein naiver Timestamp landet je nach Serverzone auf dem falschen
 *     Kalendertag — der Altbestand hat genau dieses Problem (Events mit
 *     `T22:00:00Z`, deren UTC-Tag um einen Tag daneben liegt). Deshalb geht
 *     die Umrechnung durch `normalizeDate`, das naive ISO-Werte
 *     ausdrücklich als Europe/Vienna-Wanduhrzeit interpretiert und den
 *     korrekten Instant zurückgibt (inkl. Sommerzeit).
 *
 *  2) VOKABULAR. `category` und `bundesland` sind keine Freitextfelder.
 *     Ein Inserat mit einer erfundenen Kategorie wäre in keinem Filter,
 *     auf keiner Themenseite und in keiner Suche auffindbar. Werte
 *     ausserhalb der Taxonomie werden daher auf `Sonstiges` bzw. `null`
 *     zurückgesetzt, statt sie durchzureichen.
 */

import { PRIMARY_CATEGORIES } from '@/lib/category-classifier/enrichment-taxonomy';
import { BUNDESLAND_NAMES } from '@/lib/districtsAT';
import { normalizeDate } from '@/lib/pipeline/normalize-date';

export const SUBMITTER_TYPES = ['company', 'person'] as const;
export type SubmitterType = (typeof SUBMITTER_TYPES)[number];

const CATEGORY_SET = new Set<string>(PRIMARY_CATEGORIES);
const BUNDESLAND_SET = new Set<string>(Object.keys(BUNDESLAND_NAMES));

/** Bewusst lockere Prüfung — wir wollen keine Einreichung an einem
 *  Edge-Case der Adress-Syntax verlieren. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Wie weit in der Vergangenheit ein Starttermin noch akzeptiert wird.
 * 12 h Toleranz, damit ein heute früh beginnendes, mehrtägiges Fest am
 * Nachmittag noch eingereicht werden kann — aber kein Termin von 2019.
 */
const PAST_TOLERANCE_MS = 12 * 60 * 60 * 1000;

/** Rohdaten, wie sie das Formular schickt. Alles `unknown`, weil es aus
 *  dem Netz kommt und nichts davon vertrauenswürdig ist. */
export interface SubmissionInput {
  [key: string]: unknown;
}

/** Validierte, in die DB schreibbare Zeile (Spaltennamen = DB-Spalten). */
export interface NormalizedSubmission {
  title: string;
  description: string | null;
  category: string;
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
  submitter_type: SubmitterType;
  company: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  message: string | null;
  rights_confirmed: boolean;
}

export type ValidationResult =
  | { ok: true; value: NormalizedSubmission }
  | { ok: false; error: string; field?: string };

// ─────────────────────────────────────────────────────────────────
// Helfer
// ─────────────────────────────────────────────────────────────────

/** Trimmt, kappt auf `max` Zeichen, macht Leerstrings zu `null`. */
export function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Akzeptiert nur absolute http(s)-URLs. Ein `javascript:`-Wert im
 * Bild- oder Ticket-Feld würde später ungefiltert in ein `href`/`src`
 * der öffentlichen Seite gerendert — das ist der klassische Weg, wie ein
 * offenes Formular zur XSS-Lücke wird. Alles andere fliegt raus (nicht:
 * "wird repariert" — ein halb geratener Link ist schlechter als keiner).
 */
export function cleanUrl(value: unknown, max = 500): string | null {
  const raw = clean(value, max);
  if (!raw) return null;
  // Ohne Schema ist "www.foo.at" gemeint — das ergänzen wir, weil es die
  // mit Abstand häufigste Eingabe ist.
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString().slice(0, max);
  } catch {
    return null;
  }
}

/**
 * Verbindet Datum + Uhrzeit aus dem Formular zu einem Instant.
 * `date` ist "yyyy-mm-dd", `time` ist "HH:MM" oder leer.
 *
 * Ohne Uhrzeit wird Mitternacht Wiener Zeit angesetzt — das ist die
 * ehrliche Aussage "Tag bekannt, Uhrzeit unbekannt". Wir setzen bewusst
 * KEINE Platzhalter-Uhrzeit wie 20:00; genau solche Erfindungen stecken
 * im Altbestand und sind später nicht mehr von echten Zeiten zu trennen.
 */
export function toInstant(date: string, time: string | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const iso = time && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : date;
  const { startAt } = normalizeDate(iso);
  if (!startAt) return null;
  // `startAt` ist als `Date | string` deklariert (einzelne Pfade in
  // normalize-date.ts geben bereits ISO-Strings zurück) — beides annehmen.
  const parsed = startAt instanceof Date ? startAt : new Date(startAt);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

// ─────────────────────────────────────────────────────────────────
// Validierung
// ─────────────────────────────────────────────────────────────────

/**
 * Prüft eine Einreichung und gibt entweder die schreibbare Zeile oder
 * eine Fehlermeldung in der Sprache des Formulars (Deutsch) zurück.
 *
 * @param input Rohe Formulardaten.
 * @param now   Referenzzeitpunkt — im Test injizierbar.
 */
export function validateSubmission(
  input: SubmissionInput,
  now: Date = new Date(),
): ValidationResult {
  // ── Veranstaltung ───────────────────────────────────────────────
  const title = clean(input.title, 200);
  if (!title || title.length < 3) {
    return { ok: false, error: 'Bitte einen Titel mit mindestens 3 Zeichen angeben.', field: 'title' };
  }

  const startDateRaw = clean(input.startDate, 10);
  if (!startDateRaw) {
    return { ok: false, error: 'Bitte ein Startdatum angeben.', field: 'startDate' };
  }

  const isAllDay = input.isAllDay === true;
  const startTime = isAllDay ? null : clean(input.startTime, 5);
  const start = toInstant(startDateRaw, startTime);
  if (!start) {
    return { ok: false, error: 'Das Startdatum ist ungültig.', field: 'startDate' };
  }
  if (new Date(start).getTime() < now.getTime() - PAST_TOLERANCE_MS) {
    return {
      ok: false,
      error: 'Der Termin liegt in der Vergangenheit. Bitte ein künftiges Datum angeben.',
      field: 'startDate',
    };
  }

  const endDateRaw = clean(input.endDate, 10);
  let end: string | null = null;
  if (endDateRaw) {
    const endTime = isAllDay ? null : clean(input.endTime, 5);
    end = toInstant(endDateRaw, endTime);
    if (!end) {
      return { ok: false, error: 'Das Enddatum ist ungültig.', field: 'endDate' };
    }
    if (new Date(end).getTime() < new Date(start).getTime()) {
      return {
        ok: false,
        error: 'Das Ende liegt vor dem Beginn.',
        field: 'endDate',
      };
    }
  }

  const categoryRaw = clean(input.category, 60);
  const category = categoryRaw && CATEGORY_SET.has(categoryRaw) ? categoryRaw : 'Sonstiges';

  const postalCodeRaw = clean(input.postalCode, 10);
  const postalCode = postalCodeRaw && /^\d{4}$/.test(postalCodeRaw) ? postalCodeRaw : null;

  const bundeslandRaw = clean(input.bundesland, 40)?.toLowerCase() ?? null;
  const bundesland = bundeslandRaw && BUNDESLAND_SET.has(bundeslandRaw) ? bundeslandRaw : null;

  // ── Inserent ────────────────────────────────────────────────────
  const submitterTypeRaw = clean(input.submitterType, 20);
  const submitterType: SubmitterType =
    submitterTypeRaw === 'person' ? 'person' : 'company';

  const company = clean(input.company, 200);
  if (submitterType === 'company' && !company) {
    return { ok: false, error: 'Bitte den Namen der Firma oder des Vereins angeben.', field: 'company' };
  }

  const contactName = clean(input.contactName, 200);
  if (!contactName) {
    return { ok: false, error: 'Bitte einen Ansprechpartner angeben.', field: 'contactName' };
  }

  const email = clean(input.email, 320);
  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Bitte eine gültige Mailadresse angeben.', field: 'email' };
  }

  if (input.rightsConfirmed !== true) {
    return {
      ok: false,
      error: 'Bitte bestätigen, dass du die Rechte an den Angaben und am Bild hast.',
      field: 'rightsConfirmed',
    };
  }

  return {
    ok: true,
    value: {
      title,
      description: clean(input.description, 5000),
      category,
      start_date: start,
      end_date: end,
      is_all_day: isAllDay,
      location_name: clean(input.locationName, 200),
      address: clean(input.address, 300),
      postal_code: postalCode,
      bundesland,
      price_text: clean(input.priceText, 200),
      ticket_url: cleanUrl(input.ticketUrl),
      image_url: cleanUrl(input.imageUrl),
      event_url: cleanUrl(input.eventUrl),
      organizer: clean(input.organizer, 200) ?? company ?? contactName,
      submitter_type: submitterType,
      company,
      contact_name: contactName,
      email,
      phone: clean(input.phone, 50),
      website: cleanUrl(input.website),
      message: clean(input.message, 2000),
      rights_confirmed: true,
    },
  };
}
