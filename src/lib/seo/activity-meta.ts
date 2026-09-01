/**
 * Title/Description-Aufbau für Aktivitäts-Detailseiten (SEO, 2026-09-01).
 *
 * Messung, die dazu geführt hat: die 2.849 indexierten Aktivitäts-URLs
 * sammelten 20.492 Impressionen pro Woche, brachten aber nur 157 Klicks
 * (**0,8 % CTR**, Gemeinde-Hubs schaffen 3,7 %). Ursache waren die
 * Snippets selbst — die Description war der abgeschnittene Anfang des
 * Quelltexts, was regelmäßig zu Nicht-Aussagen führte:
 *
 *     "Willkommen im Seeschloss Ort!"      (Seeschloss Ort, Gmunden)
 *     "Tauche ein in das Abenteuer"        (escape house Vorchdorf)
 *
 * Diese Zeilen geben keinen Grund zu klicken. Der Aufbau hier ist
 * bewusst DETERMINISTISCH (keine KI, MASTERPLAN §4.2): alles stammt aus
 * strukturierten DB-Feldern, jede Seite bekommt trotzdem eine eigene
 * Formulierung, weil Name, Ort, Typ und Öffnungszeiten variieren.
 *
 * Reine Funktionen — getestet in __tests__/activity-meta.test.ts.
 */

import { activityTagLabel } from '@/lib/activities/tag-labels';

/** Google schneidet Titel ab ~60 Zeichen, Descriptions bei ~155-160. */
const TITLE_MAX = 60;
const DESC_MAX = 158;

/**
 * Marketing-Floskeln, die als erster Satz keinen Informationswert haben.
 * Sie stehen in den Quelldaten sehr häufig am Textanfang und landeten
 * dadurch bisher direkt im Snippet.
 */
const FILLER_START = /^(herzlich\s+)?(willkommen|tauchen?(\s+sie)?\s+ein|erleben\s+sie|entdecken\s+sie|besuchen\s+sie|freuen\s+sie\s+sich|lassen\s+sie\s+sich)\b/i;

export interface ActivityMetaInput {
  name: string;
  town?: string | null;
  bundeslandName?: string | null;
  tags?: string[] | null;
  description?: string | null;
  descriptionShort?: string | null;
  openingTimes?: unknown;
  priceHint?: string | null;
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Kürzt an der Wortgrenze und hängt … an, wenn wirklich gekürzt wurde. */
function truncate(s: string, max: number): string {
  const t = clean(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

/** Erstes Tag als menschenlesbarer Typ ("museumstour" → "Museumstour"). */
export function activityTypeLabel(tags?: string[] | null): string | null {
  const first = (tags ?? []).find((t) => typeof t === 'string' && t.trim().length > 0);
  return first ? activityTagLabel(first.trim()) : null;
}

/**
 * Ersten informativen Satz aus dem Quelltext ziehen. Floskel-Sätze
 * ("Willkommen im …") werden übersprungen; bleibt nichts Brauchbares
 * übrig, liefert die Funktion null und die Description kommt allein aus
 * den strukturierten Feldern.
 */
export function firstUsefulSentence(text?: string | null): string | null {
  if (!text) return null;
  const sentences = clean(text).split(/(?<=[.!?])\s+/);
  for (const raw of sentences) {
    const s = clean(raw);
    if (s.length < 25) continue;          // zu kurz für echten Informationswert
    if (FILLER_START.test(s)) continue;   // Begrüßungsfloskel
    return s;
  }
  return null;
}

/**
 * Title: "<Name> in <Ort>" plus Nutzen-Suffix, solange die 60 Zeichen
 * reichen. Der bisherige Aufbau ("<Name> – <Ort>") ließ bei kurzen Namen
 * die halbe Zeile ungenutzt.
 */
export function buildActivityTitle(input: ActivityMetaInput): string {
  const name = clean(input.name);
  const where = clean(input.town ?? input.bundeslandName ?? '');
  const base = where ? `${name} in ${where}` : name;
  if (base.length > TITLE_MAX) return truncate(base, TITLE_MAX);

  // Suffixe nach Nützlichkeit sortiert — das erste, das noch passt, gewinnt.
  const suffixes = [
    input.openingTimes ? 'Öffnungszeiten & Anfahrt' : null,
    'Infos & Anfahrt',
    'Anfahrt',
  ].filter((s): s is string => Boolean(s));
  for (const suffix of suffixes) {
    const candidate = `${base} — ${suffix}`;
    if (candidate.length <= TITLE_MAX) return candidate;
  }
  return base;
}

/**
 * Description aus strukturierten Feldern: Ort + Typ zuerst (immer
 * vorhanden und immer aussagekräftig), danach ein informativer Satz aus
 * der Quelle, zum Schluss ein konkreter Hinweis auf den Seiteninhalt.
 */
export function buildActivityDescription(input: ActivityMetaInput): string {
  const name = clean(input.name);
  const town = input.town ? clean(input.town) : null;
  const bundesland = input.bundeslandName ? clean(input.bundeslandName) : null;
  const type = activityTypeLabel(input.tags);

  const place = [town, bundesland && bundesland !== town ? bundesland : null]
    .filter(Boolean)
    .join(', ');

  const lead = type
    ? `${name} in ${place || 'Österreich'} — ${type}.`
    : `${name} in ${place || 'Österreich'}.`;

  const parts: string[] = [lead];

  const sentence = firstUsefulSentence(input.descriptionShort ?? input.description);
  if (sentence) parts.push(sentence);

  if (input.priceHint) {
    // Als eigener Satz, sonst laeuft der Preis in den Schlusssatz hinein
    // ("ab € 3 Öffnungszeiten, Karte und Events…").
    const price = clean(input.priceHint);
    parts.push(/[.!?]$/.test(price) ? price : `${price}.`);
  }

  // Schluss-Hinweis nur, wenn danach noch Platz bleibt — sonst gewinnt Inhalt.
  const withoutTail = parts.join(' ');
  const tail = input.openingTimes
    ? 'Öffnungszeiten, Karte und Events in der Nähe.'
    : 'Karte, Anfahrt und Events in der Nähe.';
  const full = `${withoutTail} ${tail}`;

  return truncate(full.length <= DESC_MAX ? full : withoutTail, DESC_MAX);
}
