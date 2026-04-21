/**
 * Extract-from-HTML tests for fetch-page.ts.
 *
 * The critical regression being locked down here: previously
 * extractMainText() only accepted JSON-LD blocks whose @type was the
 * literal string "Event". oeticket, eventim, ticketmaster, wien-ticket
 * and most ticket vendors emit `@type: "MusicEvent"` (or TheaterEvent,
 * ComedyEvent, …). The old check dropped all of them and returned thin
 * "<body> only" text — which for a typical SPA is under 300 chars and
 * tells the classifier almost nothing.
 *
 * We use a real captured oeticket HTML sample (Oskar Haag Lost-Cause
 * Tour at ARGEkultur Salzburg) to prove the fix works end-to-end.
 */

import { describe, it, expect } from 'vitest';
import { extractMainText } from '../../../lib/category-classifier/fetch-page';

// ── Real-world HTML sample ──────────────────────────────────────────
// Captured from https://www.oeticket.com/event/oskar-haag-lost-cause-tour-argekultur-21423500/
// on 2026-04-21 via the user's Postman session. The key thing is the
// JSON-LD `@type: "MusicEvent"` + `offers.lowPrice: 33.00 EUR` that the
// old extractMainText dropped silently.
const OETICKET_HTML = `<!DOCTYPE html>
<html lang="de" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tickets für Oskar Haag in SALZBURG</title>
<meta name="description" content="Sichern Sie sich jetzt Ihre Karten für Oskar Haag - Lost Cause Tour am 28.10.2026 20:00 - ARGEkultur SALZBURG!">
<meta property="og:locale" content="de_AT" />
<meta property="og:url" content="https://www.oeticket.com/event/oskar-haag-lost-cause-tour-argekultur-21423500/" />
<meta property="og:site_name" content="oeticket.com" />
<meta property="og:title" content="Oskar Haag - Lost Cause Tour 2026 @ ARGEkultur | SALZBURG - Mi., 28.10.2026" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"MusicEvent","endDate":"2026-10-28T20:00:00.000+01:00","eventStatus":"https://schema.org/EventScheduled","location":{"@context":"https://schema.org","@type":"EventVenue","address":{"streetAddress":"Ulrike-Gschwandtner-Str. 5","postalCode":"5020","addressLocality":"Salzburg","addressRegion":"","addressCountry":"AT","@type":"PostalAddress"},"name":"ARGEkultur","sameAs":"https://www.oeticket.com/city/salzburg-608/venue/argekultur-salzburg-20356/"},"name":"Oskar Haag - Lost Cause Tour 2026","offers":[{"@type":"AggregateOffer","lowPrice":"33.00","highPrice":"33.00","priceCurrency":"EUR","availability":"https://schema.org/InStock","url":"https://www.oeticket.com/event/oskar-haag-lost-cause-tour-argekultur-21423500/","validFrom":"2026-03-11T10:00:00.000+01:00","itemOffered":{"@type":"Product","@context":"https://schema.org","image":"https://www.oeticket.com/obj/media/AT-eventim/teaser/222x222/2026/Oskar-Haag-Lost-Cause-Tour-2026-tickets-c-Michelle-Rassnitzer-m.jpg","name":"Stehplatz","offers":[{"@type":"Offer","category":"Stehplatz","price":"33.00","priceCurrency":"EUR","availability":"https://schema.org/InStock","validFrom":"2026-03-11T10:00:00.000+01:00"}]}}],"performer":{"@context":"https://schema.org","@type":"MusicGroup","name":"Oskar Haag","sameAs":"https://www.oeticket.com/artist/oskar-haag/"},"startDate":"2026-10-28T20:00:00.000+01:00"}
</script>
</head>
<body>
<div class="app-shell">Loading...</div>
</body>
</html>`;

describe('extractMainText — oeticket MusicEvent regression test', () => {
  const text = extractMainText(OETICKET_HTML);

  it('extracts the JSON-LD block (not just the empty body shell)', () => {
    // Before the fix: body-only fallback gave ~30 chars ("Loading...").
    // After:          JSON-LD + body gives 1500+ chars.
    expect(text.length).toBeGreaterThan(500);
  });

  it('contains the event name from JSON-LD', () => {
    expect(text).toContain('Oskar Haag');
    expect(text).toContain('Lost Cause');
  });

  it('contains the price from JSON-LD offers.lowPrice', () => {
    // This was invisible to the classifier before the fix.
    expect(text).toContain('33.00');
    expect(text).toContain('EUR');
  });

  it('contains the venue name + address from JSON-LD', () => {
    expect(text).toContain('ARGEkultur');
    expect(text).toContain('Salzburg');
    expect(text).toContain('Ulrike-Gschwandtner-Str. 5');
  });

  it('contains the ticket category ("Stehplatz")', () => {
    expect(text).toContain('Stehplatz');
  });

  it('has the [JSON-LD] prefix marker so the classifier sees it as structured', () => {
    expect(text).toContain('[JSON-LD]');
  });
});

// ── Synthetic fixture: plain "Event" still works (no regression) ─────
describe('extractMainText — plain "Event" @type still works', () => {
  const html = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Event","name":"Dorffest Rust","startDate":"2026-06-14T18:00:00+02:00","location":{"@type":"Place","name":"Rust am Neusiedlersee"}}
</script></head><body>Dorffest Rust - jährliches Weinfest mit Live-Musik und Tanz bis in die Nacht hinein. Traditionelle Küche aus der Region, Weinverkostung und Musik vom DJ-Team.</body></html>`;

  const text = extractMainText(html);

  it('still extracts plain Event JSON-LD', () => {
    expect(text).toContain('Dorffest Rust');
    expect(text).toContain('Rust am Neusiedlersee');
  });
});

// ── Synthetic fixture: non-Event JSON-LD is correctly ignored ────────
describe('extractMainText — non-Event JSON-LD skipped', () => {
  const html = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Some Product","offers":{"price":"99.00"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Some Org"}
</script></head><body>Page content about a product, not an event. ${'x'.repeat(300)}</body></html>`;

  const text = extractMainText(html);

  it('does NOT include Product or Organization JSON-LD', () => {
    expect(text).not.toContain('[JSON-LD]');
    expect(text).not.toContain('"@type":"Product"');
  });

  it('still falls through to <body> text', () => {
    expect(text).toContain('Page content about a product');
  });
});

// ── @graph-wrapped MusicEvent also works ─────────────────────────────
describe('extractMainText — @graph wrapped MusicEvent', () => {
  const html = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"WebPage","name":"Page"},
  {"@type":"MusicEvent","name":"Nova Rock 2026","startDate":"2026-06-11T12:00:00+02:00","location":{"@type":"Place","name":"Pannonia Fields"}}
]}
</script></head><body></body></html>`;

  const text = extractMainText(html);

  it('finds MusicEvent inside @graph', () => {
    expect(text).toContain('Nova Rock');
    expect(text).toContain('Pannonia Fields');
  });
});
