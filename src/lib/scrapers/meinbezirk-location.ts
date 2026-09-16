import type { CheerioAPI } from 'cheerio';
import { isRegionLabel } from './gemeinde-context';

export interface MeinBezirkLocation {
  locationName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}

function clean(value: unknown): string | undefined {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() || undefined : undefined;
}

/** Only split the event's own location label; never search article/footer text for a PLZ. */
function fromLabel(label: string): MeinBezirkLocation {
  const parts = label.split(',').map(part => part.trim()).filter(Boolean);
  const last = parts.at(-1) || '';
  const postal = last.match(/^(?:A-)?([1-9]\d{3})\s+(.+)$/);
  if (postal) {
    const before = parts.slice(0, -1);
    return {
      locationName: before[0],
      address: [...new Set(before), `${postal[1]} ${postal[2]}`].join(', '),
      postalCode: postal[1],
      city: postal[2].replace(/^Gemeinde\s+/i, ''),
    };
  }
  // "Pfarrhof, Gansbach" contains a venue and locality, but no street address.
  return {
    locationName: parts[0] && !isRegionLabel(parts[0]) ? parts[0] : undefined,
    city: parts.length === 2 && !isRegionLabel(last) ? last : undefined,
  };
}

export function extractMeinBezirkLocation($: CheerioAPI, sourceUrl?: string): MeinBezirkLocation {
  let structured: MeinBezirkLocation | undefined;
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || structured) return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Record<string, unknown>;
    if (node['@graph']) visit(node['@graph']);
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (!types.includes('Event') || structured) return;
    // Ignore recommendations for other events embedded in the same document.
    if (sourceUrl && typeof node.url === 'string' && node.url.replace(/\/$/, '') !== sourceUrl.replace(/\/$/, '')) return;
    const locations = Array.isArray(node.location) ? node.location : [node.location];
    for (const location of locations) {
      if (!location || typeof location !== 'object') continue;
      const venue = location as Record<string, unknown>;
      const name = clean(venue.name);
      const addr = venue.address;
      let data: MeinBezirkLocation = {};
      if (typeof addr === 'string') data = fromLabel(addr);
      else if (addr && typeof addr === 'object') {
        const a = addr as Record<string, unknown>;
        const street = clean(a.streetAddress);
        const city = clean(a.addressLocality)?.replace(/^Gemeinde\s+/i, '');
        const code = clean(a.postalCode);
        const postalCode = code?.match(/^(?:A-)?([1-9]\d{3})$/)?.[1];
        data = {
          city, postalCode,
          address: street ? [street, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : undefined,
        };
      }
      if (name && !isRegionLabel(name)) data.locationName = name;
      if (Object.values(data).some(Boolean)) { structured = data; break; }
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try { visit(JSON.parse($(el).text())); } catch { /* malformed block: use the event location row */ }
  });

  const row = $('.eventitem-dates-container .fa-map-marked, .eventitem-dates-container .fa-map').first().closest('tr');
  const label = clean(row.find('[title]').first().attr('title')) || clean(row.find('td').last().text());
  const fallback = label ? fromLabel(label) : {};
  // Prefer the structured venue address as one unit, avoiding mixed locations.
  return structured && (structured.address || structured.city || structured.postalCode)
    ? structured : { ...fallback, ...(structured?.locationName ? { locationName: structured.locationName } : {}) };
}
