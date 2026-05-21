// src/lib/scrapers/detail-extract/adapters/gem2go.ts
// Source-specific CSS-selector extraction for the gem2go CMS (used by
// ~2000 Austrian municipalities). Refactored out of gem2go-detail.ts.

import type { Adapter, DetailEnrichment } from '../types';

export const gem2goAdapter: Adapter = {
  sourceNames: [
    'gem2go',
    'gemeinde-registry',
    'gemeinden-generic',
    'gemeinden',
    'gemeinden-wp-burgenland',
  ],
  extract($) {
    const out: Partial<DetailEnrichment> = {};

    const venue = $('.va-vaort').first().text().trim();
    if (venue) out.location_name = venue;

    const strasse = $('.va-adr-strasse').first().text().trim();
    if (strasse) {
      const hnrRaw = $('.va-adr-hnr').first().text().trim();
      const hnr = hnrRaw.replace(/[,\s]+$/, '').trim();
      out.address = hnr ? `${strasse} ${hnr}` : strasse;
    }

    const plz = $('.va-adr-plz').first().text().trim();
    if (plz) out.postal_code = plz;

    const ort = $('.va-adr-ort').first().text().trim();
    if (ort) out.address_locality = ort;

    const organizer = $('.veranstalter_bez_veranstalter').first().text().trim()
      || $('.veranstaltername, .organizer_name').first().text().trim();
    if (organizer) out.organizer = organizer;

    // Description: target inner .mehrtext-limiter; fall back to vatext_container minus toggle.
    let candidate = $('.vatext_container .mehrtext-limiter')
      .first().text().trim().replace(/\s+/g, ' ');
    if (!candidate) {
      const $clone = $('.vatext_container').first().clone();
      $clone.find('.mehrtext-toggle, .defaultfontsize').remove();
      candidate = $clone.text().trim().replace(/\s+/g, ' ');
    }
    if (candidate && candidate !== 'mehr anzeigen' && candidate.length > 20) {
      out.description = candidate;
    }

    return out;
  },
};
