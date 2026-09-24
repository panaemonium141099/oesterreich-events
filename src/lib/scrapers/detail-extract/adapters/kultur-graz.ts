// src/lib/scrapers/detail-extract/adapters/kultur-graz.ts
//
// kultur.graz.at Detailseite: der Veranstaltungsort steht als Link im
// Infoblock („Ort: <a href="/kalender/ort/…">p.p.c</a>"), die Adresse im
// Ortsblock darunter („<p><br><b>p.p.c</b><br>Neubaugasse 6, 8020 Graz<br>…").
// Ohne Adapter las die Regex-Schicht den ganzen Infoblock samt
// „Info: … ↗ Foto: …" als location_name.

import type { Adapter, DetailEnrichment } from '../types';
import { cleanKulturGrazVenue } from '../../kultur-graz-venue';

export const kulturGrazAdapter: Adapter = {
  sourceNames: ['kultur-graz'],
  extract($) {
    const out: Partial<DetailEnrichment> = {};
    const venue = cleanKulturGrazVenue($('.infoblock a[href*="/kalender/ort/"]').first().text());
    if (venue) out.location_name = venue;
    return out;
  },
};
