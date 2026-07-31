/**
 * smart-chips — pure Ableitung der "Verstanden:"-Chips aus dem
 * `parsed`-Block der /api/search/semantic-Response (fn-19 Phase A).
 *
 * Zweck: Transparenz. Der User sieht, welche Signale die Suche aus
 * seiner Alltagssprache gezogen hat (Datum, Preis, Ort, Aktivitäts-
 * Absicht, Kategorien) — das erklärt das Ergebnis und baut Vertrauen
 * in die KI-Suche auf. Reine Funktion, damit sie testbar ist.
 */

export interface ParsedSummary {
  signals?: string[];
  max_price_tier?: string | null;
  location_district?: string | null;
  location_bundesland?: string | null;
  content_types?: string[];
}

export interface UnderstoodChip {
  key: string;
  label: string;
}

const MAX_CHIPS = 6;

const DATE_LABELS: Record<string, string> = {
  today: 'Heute',
  tomorrow: 'Morgen',
  weekend: 'Wochenende',
};

const PRICE_LABELS: Record<string, string> = {
  gratis: 'Gratis',
  'günstig': 'Günstig',
};

/** 'graz (stadt)' → 'Graz', 'wien' → 'Wien', 'sankt pölten' → 'Sankt Pölten' */
function titleCasePlace(raw: string): string {
  return raw
    .replace(/\s*\(.*\)\s*/g, '')
    .trim()
    .split(/\s+/)
    .map(w => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** '7000-eisenstadt' → 'Eisenstadt' (Gemeinde-Slug aus dem Signal). */
function gemeindeLabelFromSlug(slug: string): string {
  const namePart = slug.replace(/^\d+-/, '').replace(/-/g, ' ');
  return titleCasePlace(namePart);
}

export function buildUnderstoodChips(parsed: ParsedSummary | undefined): UnderstoodChip[] {
  if (!parsed) return [];
  const signals = parsed.signals ?? [];
  const chips: UnderstoodChip[] = [];

  // Datum (Regex-Parser-Signale 'today' | 'tomorrow' | 'weekend')
  for (const s of signals) {
    if (DATE_LABELS[s]) {
      chips.push({ key: `date:${s}`, label: DATE_LABELS[s] });
      break;
    }
  }

  // Preis
  if (parsed.max_price_tier && PRICE_LABELS[parsed.max_price_tier]) {
    chips.push({ key: 'price', label: PRICE_LABELS[parsed.max_price_tier] });
  }

  // Ort: Gemeinde-Signal ist am präzisesten, sonst Bezirk, sonst Bundesland.
  const gemeindeSignal = signals.find(s => s.startsWith('location:gemeinde:'));
  if (gemeindeSignal) {
    chips.push({ key: 'ort', label: gemeindeLabelFromSlug(gemeindeSignal.slice('location:gemeinde:'.length)) });
  } else if (parsed.location_district) {
    chips.push({ key: 'ort', label: titleCasePlace(parsed.location_district.split(',')[0].split('|')[0]) });
  } else if (parsed.location_bundesland) {
    chips.push({ key: 'ort', label: titleCasePlace(parsed.location_bundesland) });
  }

  // Indoor-Absicht ("was tun bei Regen")
  if (signals.includes('setting:indoor')) {
    chips.push({ key: 'setting', label: 'Indoor' });
  }

  // Aktivitäts-Absicht (contentTypes jenseits des Event-Defaults)
  const ct = parsed.content_types ?? [];
  if (ct.includes('activity')) {
    chips.push({
      key: 'content',
      label: ct.includes('event') ? 'Events + Ausflugsziele' : 'Ausflugsziele',
    });
  }

  // Kategorien (max 2 — 'category:Musik' → 'Musik')
  signals
    .filter(s => s.startsWith('category:'))
    .slice(0, 2)
    .forEach(s => chips.push({ key: s, label: s.slice('category:'.length) }));

  return chips.slice(0, MAX_CHIPS);
}
