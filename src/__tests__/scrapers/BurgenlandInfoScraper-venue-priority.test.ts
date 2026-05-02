/**
 * Regression test: BurgenlandInfoScraper must extract the VENUE address
 * from JSON-LD `location.address`, not the organizer/tourism-office address
 * from `organizer.address`.
 *
 * Bug history: prior to commit d088b4e, the scraper read `organizer.address`
 * first and fell back to `location.address`. That routed ~228 of 455
 * burgenland.info events to tourism-office PLZs (7000 Eisenstadt HQ, 7142
 * Illmitz, 7361 Lutzmannsburg, 7431 Bad Tatzmannsdorf, 8383 St. Martin).
 * The user-reported example was "See Opening · Neufelder See" — venue is
 * 2491 Neufeld an der Leitha, but the row landed at 7361 Lutzmannsburg
 * because that was the regional tourism-office (`organizer`) address.
 *
 * This test pins the priority and would fail if anyone reverts the order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BurgenlandInfoScraper } from '../../lib/scrapers/BurgenlandInfoScraper';

// Pinned JSON-LD payload modeled on the actual source page:
//   https://www.burgenland.info/dc/detail/Veranstaltung/see-opening-familienfest-am-neufelder-see-scwptogh
// location.address = the venue (Strandbad Neufelder See in Neufeld an der Leitha)
// organizer.address = the tourism office HQ in Lutzmannsburg
const FIXTURE_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{
  "@graph": [{
    "@type": "Event",
    "@id": "fixture-event-id",
    "name": "See Opening: Familienfest am Neufelder See",
    "description": "<p>Familienfest am See</p>",
    "startDate": "2026-05-02T11:00:00+02:00",
    "location": [{
      "@type": "Place",
      "name": "Strandbad Neufelder See",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Eisenstädterstraße 37",
        "postalCode": "2491",
        "addressLocality": "Neufeld an der Leitha",
        "addressCountry": "AT"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 47.865357,
        "longitude": 16.3873483
      }
    }],
    "organizer": [{
      "@type": "Organization",
      "name": "Burgenland Tourismus - Erlebnisregion Mittelburgenland-Rosalia",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Hauptstraße 22",
        "postalCode": "7361",
        "addressLocality": "Lutzmannsburg",
        "addressCountry": "AT"
      }
    }]
  }]
}
</script>
</head><body></body></html>`;

describe('BurgenlandInfoScraper venue-vs-organizer address priority', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts location.address (venue), NOT organizer.address (tourism office)', async () => {
    const scraper = new BurgenlandInfoScraper();
    // Inject fixture HTML — bypass real network. fetchPage is the BaseScraper's
    // single network entry point, so stubbing it covers the entire scrape path.
    vi.spyOn(
      scraper as unknown as { fetchPage: (url: string) => Promise<string> },
      'fetchPage',
    ).mockResolvedValue(FIXTURE_HTML);

    const event = await (scraper as unknown as {
      scrapeDetailPage: (link: { url: string; title: string; date: string; location: string; imageUrl: string | null }) => Promise<{
        title: string;
        location_name?: string;
        address?: string;
        postal_code?: string;
        latitude?: number;
        longitude?: number;
      } | null>;
    }).scrapeDetailPage({
      url: '/dc/detail/Veranstaltung/see-opening-fixture',
      title: 'See Opening: Familienfest am Neufelder See',
      date: '02.05.2026',
      location: '',
      imageUrl: null,
    });

    expect(event).not.toBeNull();
    // Venue, NOT tourism-office HQ
    expect(event!.address).toBe('Eisenstädterstraße 37, 2491 Neufeld an der Leitha');
    expect(event!.postal_code).toBe('2491');
    expect(event!.location_name).toBe('Strandbad Neufelder See');
    // Geo from location.geo (the venue), not organizer (which has no geo)
    expect(event!.latitude).toBeCloseTo(47.865357, 5);
    expect(event!.longitude).toBeCloseTo(16.3873483, 5);

    // Negative assertions — the scraper must NOT pick the organizer's data:
    expect(event!.address).not.toMatch(/Lutzmannsburg/);
    expect(event!.address).not.toMatch(/Hauptstraße 22/);
    expect(event!.postal_code).not.toBe('7361');
  });

  it('falls back to organizer.address only when location.address is missing', async () => {
    // If a JSON-LD payload truly lacks location.address (rare but possible),
    // the scraper should still fall back to organizer.address rather than
    // emitting null — that's safer than no address at all.
    const fallbackHtml = `<!doctype html><html><head>
      <script type="application/ld+json">
      {"@graph":[{
        "@type":"Event",
        "@id":"fallback-id",
        "name":"Fallback Test",
        "startDate":"2026-05-02T18:00:00+02:00",
        "location":[{"@type":"Place","name":"Some Venue"}],
        "organizer":[{
          "@type":"Organization",
          "address":{
            "@type":"PostalAddress",
            "streetAddress":"Org Street 1",
            "postalCode":"1010",
            "addressLocality":"Wien"
          }
        }]
      }]}
      </script></head></html>`;

    const scraper = new BurgenlandInfoScraper();
    vi.spyOn(
      scraper as unknown as { fetchPage: (url: string) => Promise<string> },
      'fetchPage',
    ).mockResolvedValue(fallbackHtml);

    const event = await (scraper as unknown as {
      scrapeDetailPage: (link: { url: string; title: string; date: string; location: string; imageUrl: string | null }) => Promise<{
        address?: string;
        postal_code?: string;
      } | null>;
    }).scrapeDetailPage({
      url: '/dc/detail/Veranstaltung/fallback-test',
      title: 'Fallback Test',
      date: '02.05.2026',
      location: '',
      imageUrl: null,
    });

    expect(event).not.toBeNull();
    expect(event!.address).toBe('Org Street 1, 1010 Wien');
    expect(event!.postal_code).toBe('1010');
  });
});
