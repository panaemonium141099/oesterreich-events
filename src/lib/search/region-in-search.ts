/**
 * Regionsname im Suchtext (2026-11-18).
 *
 * Befund: „Steiermark" im Suchfeld von /entdecken lieferte 250 Events, der
 * Bundesland-Filter Steiermark mehrere Tausend. Die Textsuche
 * (search_event_ids) sucht das Wort in Titel, Ort, Adresse und Kategorie und
 * kappt bei 250 IDs; ein Event in Graz, das „Steiermark" nirgends im Text
 * trägt, fand sie nie.
 *
 * Deshalb: nennt die Suche eine Region der Seite, wird daraus derselbe
 * Spaltenfilter, den der Regionsfilter setzt. Der Rest bleibt Suchtext
 * („konzert steiermark" = Suche „konzert" im Bundesland Steiermark).
 */
import { SITE_REGION_LIST } from '@/lib/site/regions';

/** Kleinschreibung, Umlaute ausgeschrieben, nur Buchstaben. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

const REGION_BY_NAME = new Map<string, string>();
for (const r of SITE_REGION_LIST) {
  REGION_BY_NAME.set(norm(r.name), r.id);
  REGION_BY_NAME.set(norm(r.id), r.id);
}

/** Füllwörter, die nach dem Herauslösen der Region allein übrig blieben. */
const FILLER = new Set(['in', 'im', 'der', 'dem']);

export interface RegionInSearch {
  /** Regions-ID (Wert der Regionsspalte) oder null. */
  regionId: string | null;
  /** Suchtext ohne den Regionsnamen; leer, wenn nur die Region gesucht war. */
  rest: string;
}

export function splitRegionFromSearch(search: string): RegionInSearch {
  const trimmed = search.trim();
  if (!trimmed) return { regionId: null, rest: '' };

  // Der ganze Text ist ein Regionsname (auch mehrteilige: „Nordrhein-Westfalen").
  const whole = REGION_BY_NAME.get(norm(trimmed));
  if (whole) return { regionId: whole, rest: '' };

  const tokens = trimmed.split(/\s+/);
  const idx = tokens.findIndex((t) => REGION_BY_NAME.has(norm(t)));
  if (idx < 0) return { regionId: null, rest: trimmed };

  const regionId = REGION_BY_NAME.get(norm(tokens[idx]))!;
  const rest = tokens
    .filter((_, i) => i !== idx)
    .filter((t) => !FILLER.has(t.toLowerCase()))
    .join(' ');
  return { regionId, rest };
}
