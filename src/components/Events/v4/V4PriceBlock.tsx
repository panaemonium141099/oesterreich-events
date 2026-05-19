/**
 * V4PriceBlock — labelled price breakdown for the v4 side-boxes.
 *
 * Renders nothing when no price info is known. Renders nothing for
 * priceTier='gratis' since the Eintritt-frei badge in V4FreeBox already
 * tells that story — duplicating "€0" would be noise.
 *
 * Parses `price_text` (free-form scraper output) by splitting on common
 * separators (",", ";", " / ", " | ", " · ", " — ", newline) and matching
 * a "<label> <number>€"/"€<number>" pattern per chunk. Falls back to a
 * numeric range from price_min/price_max when price_text is empty or
 * unparseable. The label defaults to "Eintritt" when a chunk only has a
 * number and no preceding word.
 */

interface PriceItem {
  label: string;
  value: string;
}

interface V4PriceBlockProps {
  priceText?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceTier?: 'gratis' | 'günstig' | 'mittel' | 'premium' | 'unbekannt' | null;
}

const FREE_RE = /^(eintritt\s+frei|freier?\s+eintritt|frei|free|kostenlos|gratis)\.?$/i;
// Comma is a separator ONLY when followed by whitespace; "7,50€" must stay
// glued together as the German decimal notation, not split into "7" + "50".
const SEPARATOR_RE = /[;\n]|,\s+|\s+\/\s+|\s+\|\s+|\s+·\s+|\s+—\s+/u;
const PRICE_RE = /^(.*?)\s*(?:€\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*€|(\d+(?:[.,]\d+)?)\s*Euro)\s*$/iu;

function parsePriceText(raw: string): PriceItem[] {
  const t = raw.trim();
  if (!t || FREE_RE.test(t)) return [];

  const chunks = t.split(SEPARATOR_RE)
    .map(s => s.trim().replace(/[.\s]+$/u, '')) // strip trailing punct so "17€." matches the regex
    .filter(Boolean);
  const items: PriceItem[] = [];

  for (const chunk of chunks) {
    const m = chunk.match(PRICE_RE);
    if (m) {
      const num = m[2] ?? m[3] ?? m[4];
      const label = (m[1] || '').replace(/[:\-–]\s*$/, '').trim() || 'Eintritt';
      items.push({ label, value: `€ ${num}` });
    } else {
      // Unparseable chunk (e.g. "Auf Anfrage") — show raw as the value.
      items.push({ label: '', value: chunk });
    }
  }
  return items;
}

export function V4PriceBlock({ priceText, priceMin, priceMax, priceTier }: V4PriceBlockProps) {
  if (priceTier === 'gratis') return null;

  let items: PriceItem[] = priceText ? parsePriceText(priceText) : [];

  if (items.length === 0 && priceMin != null) {
    if (priceMax != null && priceMax > priceMin) {
      items = [{ label: 'Eintritt', value: `€ ${priceMin} – € ${priceMax}` }];
    } else {
      items = [{ label: 'ab', value: `€ ${priceMin}` }];
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-3 rounded-[10px] px-3.5 py-2.5 border border-[var(--v4-hairline-2)] bg-[var(--v4-surface)]">
      <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--v4-ink-50)] mb-1.5">
        Preis
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between items-baseline gap-3">
            {item.label && (
              <span className="text-[12.5px] text-[var(--v4-ink-70)]">{item.label}</span>
            )}
            <span
              className={
                'text-[14px] font-bold tracking-[-0.015em] text-[var(--v4-ink)] ' +
                (item.label ? '' : 'flex-1')
              }
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
