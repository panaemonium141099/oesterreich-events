/**
 * Kurzer Preis für Karten-Badges. Nur eindeutige Angaben werden gezeigt,
 * freie Preistexte der Scraper („EUR 79.00 pro Person inkl. Sektbegleitung")
 * bleiben der Detailseite vorbehalten.
 */
import type { Event } from '@/types/events';

type PriceEvent = Pick<Event, 'price_text' | 'price_min' | 'price_max' | 'price_tier'>;

const FREE_WORDS = /^(gratis|eintritt frei|kostenlos|frei|free|freier eintritt)$/i;
const SIMPLE_PRICE = /^(ab\s*)?(\d+(?:[.,]\d{1,2})?)\s*(€|eur|euro)$/i;

function fmtAmount(n: number, fmt: string): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString(fmt, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * @param labels free: Beschriftung für Gratis; from: Vorlage mit {price} für „ab".
 * @returns Badge-Text oder null, wenn der Preis nicht knapp darstellbar ist.
 */
export function priceBadge(
  e: PriceEvent,
  labels: { free: string; from: (price: string) => string },
  fmt: string = 'de-AT',
): string | null {
  const text = (e.price_text ?? '').trim();
  if (FREE_WORDS.test(text) || e.price_tier === 'gratis'
    || (e.price_min === 0 && (e.price_max == null || e.price_max === 0))) {
    return labels.free;
  }
  if (e.price_min != null && e.price_min > 0) {
    const amount = fmtAmount(e.price_min, fmt);
    return e.price_max != null && e.price_max > e.price_min ? labels.from(amount) : `${amount} €`;
  }
  const m = SIMPLE_PRICE.exec(text);
  if (m) {
    const amount = fmtAmount(parseFloat(m[2].replace(',', '.')), fmt);
    return m[1] ? labels.from(amount) : `${amount} €`;
  }
  return null;
}
