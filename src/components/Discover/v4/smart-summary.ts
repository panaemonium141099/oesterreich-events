/**
 * smart-summary — der eine Concierge-Satz und die Nachfrage-Chips der
 * Smart-Suche (Variante A, 2026-10-23), deterministisch aus der Antwort
 * von /api/search/semantic. Kein zweiter LLM-Aufruf: die Zahlen und
 * Signale stehen schon in der Antwort, und ein Satz, der sie ehrlich
 * wiedergibt, ist mehr wert als Prosa, auf die man zehn Sekunden wartet.
 */

import type { UnderstoodChip, ParsedSummary } from './smart-chips';

export interface SummaryInput {
  count: number;
  activities: number;
  chips: UnderstoodChip[];
  signals: string[];
  unmatchedTerms: string[];
}

function chipText(chips: UnderstoodChip[]): string {
  return chips.map(c => c.label).join(' · ');
}

/** Der Satz über den Regalen. Sagt, was gefunden wurde, und was nicht. */
export function buildConciergeLine(input: SummaryInput): string {
  const { count, activities, chips, signals, unmatchedTerms } = input;
  const scope = chipText(chips);
  const fallbackNote = signals.includes('intent:fallback')
    ? ' Die KI-Deutung war gerade nicht erreichbar, ich habe nach den Wörtern deiner Anfrage gesucht.'
    : '';
  const plus = ' Mit + legst du dir Stopps in deinen Plan.';

  if (unmatchedTerms.length > 0) {
    const term = unmatchedTerms.join(' ');
    if (count === 0 && activities === 0) {
      return `Für „${term}"${scope ? ` (${scope})` : ''} habe ich nichts gefunden. Versuch es mit einem anderen Begriff, Ort oder Zeitraum.${fallbackNote}`;
    }
    return `Für „${term}" habe ich nichts gefunden. Das hier passt ${scope ? `zu ${scope}` : 'zu deiner Anfrage'}, ohne diesen Begriff:${fallbackNote}`;
  }

  if (count === 0 && activities === 0) {
    return `Nichts gefunden${scope ? ` für ${scope}` : ''}. Versuch es mit einem anderen Ort oder Zeitraum, oder lass eine Angabe weg.${fallbackNote}`;
  }

  const parts: string[] = [];
  if (count > 0) parts.push(`${count} ${count === 1 ? 'Treffer' : 'Treffer'}`);
  if (activities > 0) parts.push(`${activities} ${activities === 1 ? 'Ausflugsziel' : 'Ausflugsziele'}`);
  const what = parts.join(' und ');
  return `${what}${scope ? ` für ${scope}` : ''}.${fallbackNote}${plus}`;
}

export interface RefineChip {
  label: string;
  /** Wird an die Anfrage angehängt und neu gesucht. */
  append: string;
}

/**
 * Nachfragen, die zur Antwort passen: nur, was die Anfrage noch nicht
 * festlegt. Jeder Chip hängt Wörter an die Anfrage an, die der Parser
 * sicher versteht (Preis, Datum, Indoor, Zielgruppe).
 */
export function buildRefineChips(parsed: ParsedSummary | undefined): RefineChip[] {
  const signals = parsed?.signals ?? [];
  const chips: RefineChip[] = [];
  const hasDate = signals.some(s => s === 'today' || s === 'tomorrow' || s === 'weekend' || s.startsWith('weekday:') || s.startsWith('date:') || s.startsWith('month:'));
  const hasPrice = !!parsed?.max_price_tier;
  const hasIndoor = signals.includes('setting:indoor');
  const hasKids = signals.some(s => s === 'audience:familien-mit-kindern' || s === 'category:Familie & Kinder');

  if (!hasPrice) {
    chips.push({ label: 'Nur gratis', append: 'gratis' });
    chips.push({ label: 'Günstig', append: 'günstig' });
  }
  if (!hasDate) {
    chips.push({ label: 'Heute', append: 'heute' });
    chips.push({ label: 'Am Wochenende', append: 'am wochenende' });
  }
  if (!hasIndoor) chips.push({ label: 'Lieber indoor', append: 'indoor' });
  if (!hasKids) chips.push({ label: 'Mit Kindern', append: 'mit kindern' });
  chips.push({ label: 'Mit Freunden', append: 'mit freunden' });
  return chips.slice(0, 6);
}
