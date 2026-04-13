/**
 * Tests for individual festival lineup scrapers.
 *
 * Uses mock HTML that mimics the real page structure of each festival site.
 * These are unit tests -- they don't make network requests.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import { describe, it, expect } from 'vitest';
import { FrequencyLineupScraper } from '@/lib/lineup/scrapers/frequency';
import { NovaRockLineupScraper } from '@/lib/lineup/scrapers/nova-rock';
import { ShutdownLineupScraper } from '@/lib/lineup/scrapers/shutdown';

// ── Frequency ──────────────────────────────────────────────────────────

describe('FrequencyLineupScraper', () => {
  const scraper = new FrequencyLineupScraper();

  it('extracts artists from artist links', () => {
    const html = `
      <html><body>
        <ul>
          <li>
            <a href="https://www.frequency.at/artist/twenty-one-pilots/">
              Twenty One Pilots
              <p>Saturday</p>
              <img src="/img/21p.jpg" alt="twenty-one-pilots">
            </a>
          </li>
          <li>
            <a href="https://www.frequency.at/artist/kraftklub/">
              Kraftklub
              <p>Thursday</p>
              <img src="/img/kk.jpg" alt="kraftklub">
            </a>
          </li>
          <li>
            <a href="https://www.frequency.at/artist/lorde/">
              Lorde
              <p>Thursday</p>
              <img src="/img/lorde.jpg" alt="lorde">
            </a>
          </li>
        </ul>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(3);
    expect(artists[0].artist_name_normalized).toBe('twenty one pilots');
    expect(artists[0].day_label).toBe('Saturday');
    expect(artists[1].artist_name_normalized).toBe('kraftklub');
    expect(artists[1].day_label).toBe('Thursday');
    expect(artists[2].artist_name_normalized).toBe('lorde');
  });

  it('handles collaborative bookings', () => {
    const html = `
      <html><body>
        <ul>
          <li>
            <a href="https://www.frequency.at/artist/dj-duo/">
              DJ Alpha b2b DJ Beta
              <p>Friday</p>
            </a>
          </li>
        </ul>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(2);
    expect(artists[0].artist_name_normalized).toBe('dj alpha');
    expect(artists[1].artist_name_normalized).toBe('dj beta');
    expect(artists[0].day_label).toBe('Friday');
    expect(artists[1].day_label).toBe('Friday');
  });

  it('handles performance modifiers', () => {
    const html = `
      <html><body>
        <ul>
          <li>
            <a href="https://www.frequency.at/artist/pendulum/">
              Pendulum (DJ Set)
              <p>Saturday</p>
            </a>
          </li>
        </ul>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('pendulum');
  });

  it('skips links to the /artist/ index page', () => {
    const html = `
      <html><body>
        <a href="https://www.frequency.at/artist/">All Artists</a>
        <a href="https://www.frequency.at/artist/real-band/">Real Band</a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('real band');
  });

  it('prefers JSON-LD when available', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@type": "MusicEvent",
          "performer": [
            {"@type": "MusicGroup", "name": "JSON Band"}
          ]
        }
        </script>
      </head>
      <body>
        <a href="/artist/html-band/">HTML Band</a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('json band');
  });

  it('deduplicates artists with same normalized name', () => {
    const html = `
      <html><body>
        <a href="/artist/band-a/">Band A<p>Friday</p></a>
        <a href="/artist/band-a-2/">Band A<p>Saturday</p></a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
  });
});

// ── Nova Rock ──────────────────────────────────────────────────────────

describe('NovaRockLineupScraper', () => {
  const scraper = new NovaRockLineupScraper();

  it('extracts artists from wp-block-mainstage-artist-card elements', () => {
    const html = `
      <html><body>
        <div class="wp-block-mainstage-lineup">
          <div id="tab-2026-06-11">
            <div class="wp-block-mainstage-artist-card">
              <a href="https://www.novarock.at/artist/volbeat/">
                <img src="/img/volbeat.jpg" alt="Volbeat">
                <h3>Volbeat</h3>
              </a>
            </div>
            <div class="wp-block-mainstage-artist-card">
              <a href="https://www.novarock.at/artist/slipknot/">
                <img src="/img/slipknot.jpg" alt="Slipknot">
                <h3>Slipknot</h3>
              </a>
            </div>
          </div>
          <div id="tab-2026-06-12">
            <div class="wp-block-mainstage-artist-card">
              <a href="https://www.novarock.at/artist/green-day/">
                <img src="/img/greenday.jpg" alt="Green Day">
                <h3>Green Day</h3>
              </a>
            </div>
          </div>
        </div>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(3);
    expect(artists[0].artist_name_normalized).toBe('volbeat');
    expect(artists[0].day_label).toBe('2026-06-11');
    expect(artists[1].artist_name_normalized).toBe('slipknot');
    expect(artists[1].day_label).toBe('2026-06-11');
    expect(artists[2].artist_name_normalized).toBe('green day');
    expect(artists[2].day_label).toBe('2026-06-12');
  });

  it('falls back to generic artist links when no mainstage blocks', () => {
    const html = `
      <html><body>
        <div>
          <a href="https://www.novarock.at/artist/metallica/">
            <img alt="Metallica">
            <h3>Metallica</h3>
          </a>
          <a href="https://www.novarock.at/artist/iron-maiden/">
            <img alt="Iron Maiden">
            <h3>Iron Maiden</h3>
          </a>
        </div>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(2);
    expect(artists[0].artist_name_normalized).toBe('metallica');
    expect(artists[1].artist_name_normalized).toBe('iron maiden');
  });

  it('handles known ampersand bands', () => {
    const html = `
      <html><body>
        <div class="wp-block-mainstage-lineup">
          <div class="wp-block-mainstage-artist-card">
            <a href="/artist/seiler-speer/">
              <h3>Seiler & Speer</h3>
            </a>
          </div>
        </div>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('seiler & speer');
  });

  it('extracts artist name from img alt when h3 is missing', () => {
    const html = `
      <html><body>
        <div class="wp-block-mainstage-lineup">
          <div class="wp-block-mainstage-artist-card">
            <a href="/artist/test-band/">
              <img alt="Test Band From Alt" src="/img/test.jpg">
            </a>
          </div>
        </div>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('test band from alt');
  });
});

// ── Shutdown ───────────────────────────────────────────────────────────

describe('ShutdownLineupScraper', () => {
  const scraper = new ShutdownLineupScraper();

  it('extracts artists from line-up links', () => {
    const html = `
      <html><body>
        <div class="is-layout-grid">
          <a href="https://www.shutdownfestival.at/line-up/99-prblmz/">
            <img src="/img/99p.jpg" alt="99 Prblmz">
            99 Prblmz
          </a>
          <a href="https://www.shutdownfestival.at/line-up/art-of-fighters/">
            <img src="/img/aof.jpg" alt="Art of Fighters">
            Art of Fighters
          </a>
          <a href="https://www.shutdownfestival.at/line-up/barber/">
            <img src="/img/barber.jpg" alt="Barber">
            Barber
          </a>
        </div>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(3);
    expect(artists[0].artist_name_normalized).toBe('99 prblmz');
    expect(artists[1].artist_name_normalized).toBe('art of fighters');
    expect(artists[2].artist_name_normalized).toBe('barber');
  });

  it('skips the lineup page link itself', () => {
    const html = `
      <html><body>
        <a href="https://www.shutdownfestival.at/en/line-up/">Line-Up</a>
        <a href="https://www.shutdownfestival.at/line-up/">Full Line-Up</a>
        <a href="https://www.shutdownfestival.at/line-up/real-artist/">
          <img alt="Real Artist">
          Real Artist
        </a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('real artist');
  });

  it('handles collaborative bookings', () => {
    const html = `
      <html><body>
        <a href="/line-up/collab/">
          <img alt="MC One vs. MC Two">
          MC One vs. MC Two
        </a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(2);
    expect(artists[0].artist_name_normalized).toBe('mc one');
    expect(artists[1].artist_name_normalized).toBe('mc two');
  });

  it('uses img alt text when text content is empty', () => {
    const html = `
      <html><body>
        <a href="/line-up/silent-artist/">
          <img alt="Silent Artist" src="/img/silent.jpg">
        </a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('silent artist');
  });

  it('sets all metadata correctly', () => {
    const html = `
      <html><body>
        <a href="/line-up/test/">
          <img alt="Test Act">
          Test Act
        </a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists[0]).toMatchObject({
      artist_name_raw: 'Test Act',
      artist_name_normalized: 'test act',
      day_label: null,
      stage_name: null,
      billing: null,
      source_type: 'official_lineup',
      confidence_score: 1.0,
    });
  });

  it('skips navigation labels like "lineup"', () => {
    const html = `
      <html><body>
        <a href="/line-up/lineup/">Lineup</a>
        <a href="/line-up/real/">Real</a>
      </body></html>
    `;

    const artists = scraper.scrapeLineup(html);
    expect(artists.length).toBe(1);
    expect(artists[0].artist_name_normalized).toBe('real');
  });
});
