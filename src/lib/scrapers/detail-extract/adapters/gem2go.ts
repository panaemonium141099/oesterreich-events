// src/lib/scrapers/detail-extract/adapters/gem2go.ts
// Source-specific CSS-selector extraction for the gem2go CMS (used by
// ~2000 Austrian municipalities). Refactored out of gem2go-detail.ts.

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Adapter, DetailEnrichment } from '../types';

/** Wert eines Listeneintrags im neuen Layout: `<li><span class="sr-only">Adresse</span>…</li>`. */
function bemField($: CheerioAPI, $scope: Cheerio<any>, label: string): string {
  const $li = $scope
    .find('li.bemList__item')
    .filter((_, li) => $(li).find('.sr-only').first().text().trim() === label)
    .first();
  if (!$li.length) return '';
  return $li.clone().find('.sr-only, [aria-hidden="true"]').remove().end().text().replace(/\s+/g, ' ').trim();
}

export const gem2goAdapter: Adapter = {
  sourceNames: [
    'gem2go',
    'gemeinde-registry',
    'gemeinden-generic',
    'gemeinden',
    'gemeinden-wp-burgenland',
  ],
  // Fußzeile der Gemeinde-Website (Gemeindeamt) und Veranstalterblock (dessen
  // eigene Adresse): nie der Veranstaltungsort. Die Proximity-Schicht las sie
  // sonst als Event-Adresse (Befund 2026-10-07).
  ignoreRegions: '#footer, footer, .bemContainer--mainHostContact',
  // Im neuen Layout trägt das JSON-LD als Ort die Adresse des Veranstalters
  // (Stichprobe 2026-10-07: 17 von 17), auch wenn die Seite einen anderen
  // Ort nennt. Ort und Adresse dort nur aus dem sichtbaren Kontaktblock.
  jsonLdLocationReliable: ($) => $('.bemContainer').length === 0,
  extract($) {
    const out: Partial<DetailEnrichment> = {};

    // Neues Detaillayout: der Ort steht im Block "Kontakt"
    // (.bemContainer--contact). Der Veranstalter hat einen eigenen Block mit
    // seiner Adresse (.bemContainer--mainHostContact), die nicht der Ort ist.
    const $contact = $('.bemContainer--contact').first();
    const bemVenue = bemField($, $contact, 'Veranstaltungsstätte') || bemField($, $contact, 'Standort');
    if (bemVenue) out.location_name = bemVenue;
    const bemAddress = bemField($, $contact, 'Adresse');
    const parts = bemAddress.match(/^(?:(.+?),\s*)?(\d{4})\s+([^,]+)/);
    if (parts) {
      // "Hans-Holz-Straße 1, 4770 Andorf", "3681 Hofamt Priel", "Europastraße, 3902 Vitis, Österreich"
      if (parts[1]) out.address = parts[1].trim();
      out.postal_code = parts[2];
      out.address_locality = parts[3].trim();
    } else if (bemAddress) {
      out.address = bemAddress;
    }
    const bemOrganizer =
      bemField($, $contact, 'Organisator') || bemField($, $('.bemContainer--mainHostContact').first(), 'Organisator');
    if (bemOrganizer) out.organizer = bemOrganizer;

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
