// src/lib/scrapers/detail-extract/adapters/eventfrog.ts
//
// eventfrog.at packs venue + street + city into ONE span:
//   <span class="location-title">Venue Name, Street 12, City, AT</span>
// No JSON-LD, no microdata. Parse the comma-separated string.
// "Online-Event" with no comma — leave address unset.

import type { Adapter, DetailEnrichment } from '../types';

export const eventfrogAdapter: Adapter = {
  sourceNames: ['eventfrog'],
  extract($) {
    const out: Partial<DetailEnrichment> = {};
    const raw = $('.location-title').first().text().trim().replace(/\s+/g, ' ');
    if (!raw) return out;

    // "Online-Event" / "Online" with no comma → nothing physical
    if (!raw.includes(',') && /^online/i.test(raw)) return out;

    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return out;

    // First part is venue
    out.location_name = parts[0];

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      // PLZ + Stadt (Austrian 4-digit; Hungarian/German also)
      const pm = p.match(/^(\d{4,5})\s+([A-ZÄÖÜa-zäöüß][A-Za-zäöüß\-\s]+)$/u);
      if (pm) {
        if (!out.postal_code) out.postal_code = pm[1];
        if (!out.address_locality) out.address_locality = pm[2].trim();
        continue;
      }
      // Plain 4-digit PLZ alone
      if (/^\d{4,5}$/.test(p)) {
        if (!out.postal_code) out.postal_code = p;
        continue;
      }
      // Country code: 'AT', 'HU', 'CH', 'DE' — skip
      if (/^[A-Z]{2}$/.test(p)) continue;
      // Street: token containing a digit (street + number)
      if (/\d/.test(p) && !out.address) {
        out.address = p;
        continue;
      }
      // City (no digit) — use only if we don't yet have address_locality.
      // Match wide Unicode letters (handles Inárcs, Bad Vöslau, etc.).
      if (!out.address_locality && /^\p{Lu}[\p{L}\- ]+$/u.test(p)) {
        out.address_locality = p;
      }
    }

    return out;
  },
};
