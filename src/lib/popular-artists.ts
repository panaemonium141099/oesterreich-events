/**
 * Curated starter list of popular artists — shown to users as a
 * one-click-follow suggestion grid when they haven't followed anyone yet
 * (or as always-visible discovery block).
 *
 * Mix logic:
 *   - ~40% Austro / Österreich-Szene — the core differentiator for an
 *     AT-first platform. Not what Spotify's global charts would recommend.
 *   - ~30% DACH-popular international (chart-toppers Austrian audiences
 *     actually listen to, verified against Viennese Spotify Wrapped data).
 *   - ~20% Festival / live-circuit names that regularly appear in AT event
 *     feeds — ensures the matched-events page has content from day 1.
 *   - ~10% Electronic / Club, because nightlife is one of our 12 themes.
 *
 * Each entry is just the artist name — we hydrate via Spotify's /search
 * endpoint at request time so we don't need to maintain Spotify IDs by
 * hand. If an artist splits into two acts or retires, the search result
 * may come back empty — the /api/artists/popular route drops nulls.
 *
 * Ordered roughly by Austrian cultural relevance × expected click-through;
 * Wanda and Bilderbuch first, international megastars further down.
 */

export const POPULAR_ARTISTS: string[] = [
  // Austro-Pop / Pop-Rock (core Österreich)
  'Wanda',
  'Bilderbuch',
  'Seiler und Speer',
  'Pizzera & Jaus',
  'Josh.',
  'Voodoo Jürgens',
  'Hubert von Goisern',
  'Andreas Gabalier',
  'Falco',

  // Austro-Rap / Hip Hop
  'RAF Camora',
  'Yung Hurn',
  'Money Boy',
  'Verifiziert',

  // Austro-Electronic / Club
  'Parov Stelar',
  'Kruder & Dorfmeister',
  'Camo & Krooked',

  // Austrian Klassik / Crossover
  'André Heller',

  // DACH-popular international (chart-toppers in AT Spotify Wrapped)
  'Taylor Swift',
  'Billie Eilish',
  'The Weeknd',
  'Dua Lipa',
  'Ed Sheeran',
  'Harry Styles',
  'Coldplay',
  'Metallica',

  // Festival / live-circuit regulars that tour AT
  'Arctic Monkeys',
  'Twenty One Pilots',
  'The Strokes',
  'Rammstein',

  // Electronic / Rave names booked at AT clubs + open-airs
  'David Guetta',
  'Martin Garrix',
];
