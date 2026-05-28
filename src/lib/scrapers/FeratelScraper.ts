import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * Configuration for a single Deskline/Feratel TOSC5 region.
 *
 * The `code` is the path prefix used in the webapi.deskline.net REST API,
 * e.g. "blsalzb" for SalzburgerLand, "innsbruck" for Innsbruck region.
 */
interface FeratelRegionConfig {
  /** API path prefix (e.g. "blsalzb", "innsbruck") */
  code: string;
  /** Human-readable region name */
  name: string;
  /** Austrian Bundesland */
  bundesland: string;
  /** Approximate center latitude (fallback when event has no coordinates) */
  fallbackLat: number;
  /** Approximate center longitude (fallback when event has no coordinates) */
  fallbackLng: number;
}

// ─────────────────── Region configurations ───────────────────
// Discovered by probing webapi.deskline.net with known tourism organization codes.
// Each returns 200 OK with event data.

const REGIONS: FeratelRegionConfig[] = [
  // Generated from feratel-active-urls.txt (2026-05-28 4-phase bruteforce: 12.653 slugs
  // probed, 131 active, 3 mirrors skipped — kaerntencard/kaerntenevents/innsbruckcard
  // are duplicate views of canonical regions and would double-count events).

  // ── Burgenland ──
  { code: 'burgenland', name: 'Burgenland', bundesland: 'Burgenland', fallbackLat: 47.845, fallbackLng: 16.525 },  // 958 events
  { code: 'oberwart', name: 'Oberwart', bundesland: 'Burgenland', fallbackLat: 47.286, fallbackLng: 16.211 },  // 168 events
  { code: 'lutzmannsburg', name: 'Lutzmannsburg', bundesland: 'Burgenland', fallbackLat: 47.452, fallbackLng: 16.56 },  // 128 events
  { code: 'eisenstadt', name: 'Eisenstadt', bundesland: 'Burgenland', fallbackLat: 47.846, fallbackLng: 16.526 },  // 110 events
  { code: 'illmitz', name: 'Illmitz', bundesland: 'Burgenland', fallbackLat: 47.77, fallbackLng: 16.802 },  // 62 events
  { code: 'eisenberg', name: 'Eisenberg an der Pinka', bundesland: 'Burgenland', fallbackLat: 47.689, fallbackLng: 16.531 },  // 44 events
  { code: 'podersdorf', name: 'Podersdorf am See', bundesland: 'Burgenland', fallbackLat: 47.852, fallbackLng: 16.847 },  // 42 events
  { code: 'gols', name: 'Gols', bundesland: 'Burgenland', fallbackLat: 47.689, fallbackLng: 16.531 },  // 34 events
  { code: 'rust', name: 'Rust', bundesland: 'Burgenland', fallbackLat: 47.798, fallbackLng: 16.679 },  // 33 events
  { code: 'jois', name: 'Jois', bundesland: 'Burgenland', fallbackLat: 47.969, fallbackLng: 16.788 },  // 27 events

  // ── Niederösterreich ──
  { code: 'neustadt', name: 'Neustadt (vermutl. Wiener Neustadt)', bundesland: 'Niederösterreich', fallbackLat: 48.108, fallbackLng: 15.805 },  // 72 events
  { code: 'gmuend', name: 'Gmuend', bundesland: 'Niederösterreich', fallbackLat: 48.77, fallbackLng: 14.978 },  // 61 events

  // ── Oberösterreich ──
  { code: 'salzkammergut', name: 'Salzkammergut', bundesland: 'Oberösterreich', fallbackLat: 47.714, fallbackLng: 13.621 },  // 804 events
  { code: 'donauooe', name: 'Donau Oberösterreich', bundesland: 'Oberösterreich', fallbackLat: 48.305, fallbackLng: 14.3 },  // 465 events
  { code: 'pyhrn', name: 'Pyhrn-Priel', bundesland: 'Oberösterreich', fallbackLat: 47.715, fallbackLng: 14.116 },  // 414 events
  { code: 'traunseealmtal', name: 'Traunsee-Almtal', bundesland: 'Oberösterreich', fallbackLat: 47.862, fallbackLng: 13.789 },  // 366 events
  { code: 'wels', name: 'Wels', bundesland: 'Oberösterreich', fallbackLat: 48.16, fallbackLng: 14.025 },  // 205 events
  { code: 'linz', name: 'Linz', bundesland: 'Oberösterreich', fallbackLat: 48.306, fallbackLng: 14.286 },  // 19 events
  { code: 'reichenau', name: 'Reichenau im Mühlkreis', bundesland: 'Oberösterreich', fallbackLat: 48.025, fallbackLng: 14.105 },  // 11 events
  { code: 'waldburg', name: 'Waldburg (Mühlviertel)', bundesland: 'Oberösterreich', fallbackLat: 48.025, fallbackLng: 14.105 },  // 3 events

  // ── Salzburg ──
  { code: 'blsalzb', name: 'SalzburgerLand', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 4127 events
  { code: 'lungau', name: 'Lungau', bundesland: 'Salzburg', fallbackLat: 47.075, fallbackLng: 13.685 },  // 452 events
  { code: 'tennengau', name: 'Tennengau', bundesland: 'Salzburg', fallbackLat: 47.568, fallbackLng: 13.19 },  // 440 events
  { code: 'sportwelt', name: 'Salzburger Sportwelt (Ski Amadé)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 392 events
  { code: 'seenland', name: 'Salzburger Seenland', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 329 events
  { code: 'gastein', name: 'Gastein', bundesland: 'Salzburg', fallbackLat: 47.114, fallbackLng: 13.133 },  // 265 events
  { code: 'snowspace', name: 'Snow Space Salzburg', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 222 events
  { code: 'fuschlsee', name: 'Fuschlseeregion', bundesland: 'Salzburg', fallbackLat: 47.786, fallbackLng: 13.31 },  // 194 events
  { code: 'werfenweng', name: 'Werfenweng', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 154 events
  { code: 'wagrain', name: 'Wagrain-Kleinarl', bundesland: 'Salzburg', fallbackLat: 47.333, fallbackLng: 13.3 },  // 98 events
  { code: 'abtenau', name: 'Abtenau', bundesland: 'Salzburg', fallbackLat: 47.564, fallbackLng: 13.349 },  // 93 events
  { code: 'schmitten', name: 'Schmittenhöhe (Zell am See)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 91 events
  { code: 'zellkaprun', name: 'Zell am See-Kaprun', bundesland: 'Salzburg', fallbackLat: 47.323, fallbackLng: 12.796 },  // 89 events
  { code: 'rauris', name: 'Rauris', bundesland: 'Salzburg', fallbackLat: 47.224, fallbackLng: 12.991 },  // 83 events
  { code: 'hochkoenig', name: 'Hochkoenig', bundesland: 'Salzburg', fallbackLat: 47.42, fallbackLng: 13.075 },  // 77 events
  { code: 'badvigaun', name: 'Bad Vigaun (Tennengau)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 76 events
  { code: 'grossarl', name: 'Grossarltal', bundesland: 'Salzburg', fallbackLat: 47.238, fallbackLng: 13.193 },  // 72 events
  { code: 'filzmoos', name: 'Filzmoos', bundesland: 'Salzburg', fallbackLat: 47.435, fallbackLng: 13.522 },  // 66 events
  { code: 'flachau', name: 'Flachau', bundesland: 'Salzburg', fallbackLat: 47.34, fallbackLng: 13.392 },  // 66 events
  { code: 'golling', name: 'Golling', bundesland: 'Salzburg', fallbackLat: 47.592, fallbackLng: 13.167 },  // 59 events
  { code: 'altenmarkt', name: 'Altenmarkt-Zauchensee', bundesland: 'Salzburg', fallbackLat: 47.381, fallbackLng: 13.425 },  // 55 events
  { code: 'hallein', name: 'Hallein', bundesland: 'Salzburg', fallbackLat: 47.687, fallbackLng: 13.098 },  // 51 events
  { code: 'radstadt', name: 'Radstadt', bundesland: 'Salzburg', fallbackLat: 47.382, fallbackLng: 13.461 },  // 49 events
  { code: 'werfen', name: 'Werfen', bundesland: 'Salzburg', fallbackLat: 47.479, fallbackLng: 13.189 },  // 46 events
  { code: 'krimml', name: 'Krimml', bundesland: 'Salzburg', fallbackLat: 47.222, fallbackLng: 12.172 },  // 39 events
  { code: 'kuchl', name: 'Kuchl (Tennengau)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 37 events
  { code: 'uttendorf', name: 'Uttendorf', bundesland: 'Salzburg', fallbackLat: 47.277, fallbackLng: 12.566 },  // 33 events
  { code: 'annaberg', name: 'Annaberg-Lungoetz', bundesland: 'Salzburg', fallbackLat: 47.536, fallbackLng: 13.41 },  // 23 events
  { code: 'russbach', name: 'Russbach am Pass Gschütt', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 19 events
  { code: 'embach', name: 'Embach (Pinzgau)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 18 events
  { code: 'elsbethen', name: 'Elsbethen (Salzburg-Umgebung)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 17 events
  { code: 'viehhofen', name: 'Viehhofen', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 15 events
  { code: 'eben', name: 'Eben im Pongau', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 15 events
  { code: 'stkoloman', name: 'St. Koloman (Tennengau)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 12 events
  { code: 'groedig', name: 'Grödig (Salzburg-Umgebung)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 9 events
  { code: 'eugendorf', name: 'Eugendorf', bundesland: 'Salzburg', fallbackLat: 47.867, fallbackLng: 13.13 },  // 8 events
  { code: 'anthering', name: 'Anthering (Flachgau)', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.06 },  // 1 events

  // ── Steiermark ──
  { code: 'oststeiermark', name: 'Oststeiermark', bundesland: 'Steiermark', fallbackLat: 47.18, fallbackLng: 15.9 },  // 634 events
  { code: 'thermenland', name: 'Thermenland Steiermark', bundesland: 'Steiermark', fallbackLat: 46.878, fallbackLng: 16.02 },  // 348 events
  { code: 'dachstein', name: 'Dachstein-Salzkammergut', bundesland: 'Steiermark', fallbackLat: 47.53, fallbackLng: 13.627 },  // 319 events
  { code: 'ausseerland', name: 'Ausseerland-Salzkammergut', bundesland: 'Steiermark', fallbackLat: 47.608, fallbackLng: 13.783 },  // 244 events
  { code: 'tauplitz', name: 'Tauplitz / Tauplitzalm', bundesland: 'Steiermark', fallbackLat: 47.566, fallbackLng: 14.011 },  // 244 events
  { code: 'spielberg', name: 'Spielberg (Red Bull Ring, Murtal)', bundesland: 'Steiermark', fallbackLat: 47.359, fallbackLng: 14.886 },  // 119 events
  { code: 'erzberg', name: 'Erzberg / Eisenerz', bundesland: 'Steiermark', fallbackLat: 47.359, fallbackLng: 14.886 },  // 95 events
  { code: 'gesaeuse', name: 'Gesaeuse', bundesland: 'Steiermark', fallbackLat: 47.577, fallbackLng: 14.627 },  // 83 events
  { code: 'frein', name: 'Frein an der Mürz', bundesland: 'Steiermark', fallbackLat: 47.359, fallbackLng: 14.886 },  // 83 events
  { code: 'ramsau', name: 'Ramsau am Dachstein', bundesland: 'Steiermark', fallbackLat: 47.421, fallbackLng: 13.643 },  // 39 events

  // ── Tirol ──
  { code: 'innsbruck', name: 'Innsbruck', bundesland: 'Tirol', fallbackLat: 47.26, fallbackLng: 11.395 },  // 331 events
  { code: 'zillertal', name: 'Zillertal', bundesland: 'Tirol', fallbackLat: 47.169, fallbackLng: 11.875 },  // 294 events
  { code: 'osttirol', name: 'Osttirol', bundesland: 'Tirol', fallbackLat: 46.828, fallbackLng: 12.77 },  // 266 events
  { code: 'seefeld', name: 'Seefeld', bundesland: 'Tirol', fallbackLat: 47.33, fallbackLng: 11.188 },  // 232 events
  { code: 'alpbach', name: 'Alpbachtal', bundesland: 'Tirol', fallbackLat: 47.395, fallbackLng: 11.945 },  // 221 events
  { code: 'kufstein', name: 'Kufstein', bundesland: 'Tirol', fallbackLat: 47.583, fallbackLng: 12.166 },  // 209 events
  { code: 'stubaital', name: 'Stubaital', bundesland: 'Tirol', fallbackLat: 47.085, fallbackLng: 11.31 },  // 180 events
  // skip mirror: innsbruckcard (175 events) — duplicate of canonical region
  { code: 'pillerseetal', name: 'Pillerseetal', bundesland: 'Tirol', fallbackLat: 47.449, fallbackLng: 12.582 },  // 168 events
  { code: 'oetztal', name: 'Oetztal', bundesland: 'Tirol', fallbackLat: 47.014, fallbackLng: 10.86 },  // 164 events
  { code: 'zillertalarena', name: 'Zillertal Arena', bundesland: 'Tirol', fallbackLat: 47.26, fallbackLng: 11.395 },  // 148 events
  { code: 'halltirol', name: 'Hall in Tirol', bundesland: 'Tirol', fallbackLat: 47.289, fallbackLng: 11.508 },  // 141 events
  { code: 'imst', name: 'Imst-Gurgltal', bundesland: 'Tirol', fallbackLat: 47.245, fallbackLng: 10.74 },  // 140 events
  { code: 'tvbpitztal', name: 'Pitztal', bundesland: 'Tirol', fallbackLat: 47.014, fallbackLng: 10.764 },  // 136 events
  { code: 'kitzski', name: 'KitzSki / Kitzbühel-Kirchberg', bundesland: 'Tirol', fallbackLat: 47.446, fallbackLng: 12.391 },  // 126 events
  { code: 'lech', name: 'Lech-Zuers', bundesland: 'Tirol', fallbackLat: 47.211, fallbackLng: 10.142 },  // 119 events
  { code: 'reutte', name: 'Reutte-Naturparkregion', bundesland: 'Tirol', fallbackLat: 47.485, fallbackLng: 10.718 },  // 119 events
  { code: 'hochfuegen', name: 'Hochfügen', bundesland: 'Tirol', fallbackLat: 47.255, fallbackLng: 11.842 },  // 118 events
  { code: 'wipptal', name: 'Wipptal', bundesland: 'Tirol', fallbackLat: 47.085, fallbackLng: 11.46 },  // 89 events
  { code: 'kaiserwinkl', name: 'Kaiserwinkl', bundesland: 'Tirol', fallbackLat: 47.625, fallbackLng: 12.3 },  // 87 events
  { code: 'fischen', name: 'Fischen / Tannheimer Tal', bundesland: 'Tirol', fallbackLat: 47.26, fallbackLng: 11.395 },  // 78 events
  { code: 'hochpustertal', name: 'Hochpustertal', bundesland: 'Tirol', fallbackLat: 46.74, fallbackLng: 12.42 },  // 74 events
  { code: 'lechtal', name: 'Lechtal', bundesland: 'Tirol', fallbackLat: 47.261, fallbackLng: 10.555 },  // 56 events
  { code: 'serfaus', name: 'Serfaus-Fiss-Ladis', bundesland: 'Tirol', fallbackLat: 47.039, fallbackLng: 10.602 },  // 50 events
  { code: 'arlberg', name: 'Arlberg', bundesland: 'Tirol', fallbackLat: 47.13, fallbackLng: 10.212 },  // 41 events
  { code: 'stanton', name: 'St. Anton am Arlberg', bundesland: 'Tirol', fallbackLat: 47.128, fallbackLng: 10.268 },  // 41 events
  { code: 'galtuer', name: 'Galtür', bundesland: 'Tirol', fallbackLat: 46.969, fallbackLng: 10.184 },  // 39 events
  { code: 'ischgl', name: 'Ischgl-Paznaun', bundesland: 'Tirol', fallbackLat: 47.01, fallbackLng: 10.293 },  // 39 events
  { code: 'kappl', name: 'Kappl (Paznaun)', bundesland: 'Tirol', fallbackLat: 47.073, fallbackLng: 10.382 },  // 39 events
  { code: 'kirchberg', name: 'Kirchberg in Tirol', bundesland: 'Tirol', fallbackLat: 47.449, fallbackLng: 12.32 },  // 33 events
  { code: 'mayrhofen', name: 'Mayrhofen', bundesland: 'Tirol', fallbackLat: 47.16, fallbackLng: 11.862 },  // 27 events
  { code: 'defereggen', name: 'Defereggental', bundesland: 'Tirol', fallbackLat: 47.26, fallbackLng: 11.395 },  // 17 events
  { code: 'kaltenbach', name: 'Kaltenbach (Zillertal)', bundesland: 'Tirol', fallbackLat: 47.295, fallbackLng: 11.873 },  // 14 events

  // ── Vorarlberg ──
  { code: 'bludenz', name: 'Bludenz', bundesland: 'Vorarlberg', fallbackLat: 47.155, fallbackLng: 9.823 },  // 235 events
  { code: 'klostertal', name: 'Klostertal', bundesland: 'Vorarlberg', fallbackLat: 47.13, fallbackLng: 10.08 },  // 68 events
  { code: 'rieden', name: 'Rieden', bundesland: 'Vorarlberg', fallbackLat: 47.25, fallbackLng: 9.879 },  // 36 events
  { code: 'bezau', name: 'Bezau (Bregenzerwald)', bundesland: 'Vorarlberg', fallbackLat: 47.25, fallbackLng: 9.879 },  // 1 events
  { code: 'reuthe', name: 'Reuthe (Bregenzerwald)', bundesland: 'Vorarlberg', fallbackLat: 47.25, fallbackLng: 9.879 },  // 1 events
  { code: 'bizau', name: 'Bizau (Bregenzerwald)', bundesland: 'Vorarlberg', fallbackLat: 47.25, fallbackLng: 9.879 },  // 1 events

  // ── Kärnten ──
  { code: 'kaernten', name: 'Kaernten', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },  // 2403 events
  // skip mirror: kaerntencard (2403 events) — duplicate of canonical region
  // skip mirror: kaerntenevents (2403 events) — duplicate of canonical region
  { code: 'hohetauern', name: 'Hohe Tauern', bundesland: 'Kärnten', fallbackLat: 46.91, fallbackLng: 13.15 },  // 721 events
  { code: 'badkleinkirchheim', name: 'Bad Kleinkirchheim', bundesland: 'Kärnten', fallbackLat: 46.813, fallbackLng: 13.793 },  // 683 events
  { code: 'woerthersee', name: 'Woerthersee', bundesland: 'Kärnten', fallbackLat: 46.627, fallbackLng: 14.138 },  // 637 events
  { code: 'klagenfurt', name: 'Klagenfurt', bundesland: 'Kärnten', fallbackLat: 46.624, fallbackLng: 14.308 },  // 462 events
  { code: 'klopeinersee', name: 'Klopeiner See / Südkärnten', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },  // 255 events
  { code: 'feldamsee', name: 'Feld am See', bundesland: 'Kärnten', fallbackLat: 46.775, fallbackLng: 13.748 },  // 218 events
  { code: 'nationalpark', name: 'Nationalpark Region', bundesland: 'Kärnten', fallbackLat: 46.928, fallbackLng: 13.2 },  // 169 events
  { code: 'weissensee', name: 'Weissensee', bundesland: 'Kärnten', fallbackLat: 46.713, fallbackLng: 13.3 },  // 166 events
  { code: 'nassfeld', name: 'Nassfeld-Pressegger See', bundesland: 'Kärnten', fallbackLat: 46.559, fallbackLng: 13.28 },  // 152 events
  { code: 'villach', name: 'Villach', bundesland: 'Kärnten', fallbackLat: 46.611, fallbackLng: 13.851 },  // 119 events
  { code: 'rosental', name: 'Rosental', bundesland: 'Kärnten', fallbackLat: 46.54, fallbackLng: 14.18 },  // 98 events
  { code: 'lesachtal', name: 'Lesachtal', bundesland: 'Kärnten', fallbackLat: 46.7, fallbackLng: 12.84 },  // 90 events
  { code: 'kirchbach', name: 'Kirchbach im Gailtal', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },  // 55 events
  { code: 'rennweg', name: 'Rennweg am Katschberg', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },  // 23 events
  { code: 'heiligenblut', name: 'Heiligenblut am Großglockner', bundesland: 'Kärnten', fallbackLat: 47.034, fallbackLng: 12.846 },  // 21 events
  { code: 'hochrindl', name: 'Hochrindl (Nockberge)', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },  // 21 events
  { code: 'malta', name: 'Malta (Maltatal Hohe Tauern)', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },  // 9 events
  { code: 'falkert', name: 'Falkert / Nockberge', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },  // 8 events

  // ── Österreich ──
  { code: 'oberbuch', name: 'Oberbuch', bundesland: 'Österreich', fallbackLat: 47.5, fallbackLng: 14.5 },  // 140 events
  { code: 'lahnstein', name: 'Lahnstein', bundesland: 'Österreich', fallbackLat: 47.5, fallbackLng: 14.5 },  // 65 events
  { code: 'kohlgrub', name: 'Kohlgrub', bundesland: 'Österreich', fallbackLat: 47.5, fallbackLng: 14.5 },  // 42 events
  { code: 'hochwald', name: 'Hochwald', bundesland: 'Österreich', fallbackLat: 47.5, fallbackLng: 14.5 },  // 34 events
];

// ─────────────────── API configuration ───────────────────

const API_BASE = 'https://webapi.deskline.net';
const DW_SOURCE = 'desklineweb';

/** Fields requested from the API — GraphQL-like field selection */
const EVENT_FIELDS = [
  'id',
  'name',
  'date',
  'hasMoreDates',
  'location{place,town,regions,country,coordinate{name,long,lat}}',
  'descriptions(types:[32]){description,type}',
  // Feratel image size IDs (probed 2026-05-26):
  //   1   = 1 KB (tiny thumb)
  //   2   = 13 KB (small)
  //   5   = 7 KB (small-ish)
  //   10  = 69 KB (large — sharp on hero, ~1200px wide)  ← we pick this
  //   40  = 24 KB (medium)
  //   50  = 60 KB (large alt)
  //   54  = 302 redirect / empty — was our previous default and produced
  //         pixelated hero images because the listing scraper got nothing
  //         usable back. Replaced 2026-05-26.
  //   100 = 69 KB (large, identical to 10)
  'images(count:1,sizes:[10]){urls}',
  'urlFriendlyName',
  'mainCriteria{id,name,value}',
  'eventGroups{id,name}',
].join(',');

const PAGE_SIZE = 50;

// ─────────────────── Helper functions ───────────────────

/** Generate a session ID in the format the widget uses */
function generateSessionId(): string {
  return `L${Date.now()}`;
}

/** Strip HTML tags from description */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Map Bundesland string from API regions to our Bundesland names */
function mapBundesland(regions: string[] | null, configBundesland: string): string {
  if (!regions || regions.length === 0) return configBundesland;

  const regionStr = regions.join(' ').toLowerCase();

  if (regionStr.includes('burgenland')) return 'Burgenland';
  if (regionStr.includes('wien') || regionStr.includes('vienna')) return 'Wien';
  if (regionStr.includes('niederösterreich') || regionStr.includes('niederoesterreich') || regionStr.includes('lower austria')) return 'Niederösterreich';
  if (regionStr.includes('oberösterreich') || regionStr.includes('oberoesterreich') || regionStr.includes('upper austria')) return 'Oberösterreich';
  if (regionStr.includes('salzburg')) return 'Salzburg';
  if (regionStr.includes('tirol') || regionStr.includes('tyrol')) return 'Tirol';
  if (regionStr.includes('vorarlberg')) return 'Vorarlberg';
  if (regionStr.includes('kärnten') || regionStr.includes('kaernten') || regionStr.includes('carinthia')) return 'Kärnten';
  if (regionStr.includes('steiermark') || regionStr.includes('styria')) return 'Steiermark';

  return configBundesland;
}

// ─────────────────── API response types ───────────────────

interface DesklineEvent {
  id: string;
  name: string;
  date: string;
  hasMoreDates?: boolean;
  location?: {
    place?: string;
    town?: string;
    regions?: string[];
    country?: string;
    coordinate?: {
      name?: string;
      long?: number;
      lat?: number;
    } | null;
  };
  descriptions?: Array<{
    description: string;
    type: number;
  }>;
  images?: Array<{
    urls?: string[];
  }>;
  urlFriendlyName?: string;
  mainCriteria?: {
    id: string;
    name: string;
    value: string;
  } | null;
  eventGroups?: Array<{
    id: string;
    name: string;
  }> | null;
}

interface DesklineResponse {
  data: DesklineEvent[];
  paging: {
    pageNo: number;
    pageSize: number;
    pageCount: number;
    totalRecordCount: number;
  };
  links: {
    prev: string | null;
    next: string | null;
  };
}

// ─────────────────── Scraper ───────────────────

export class FeratelScraper extends BaseScraper {
  readonly name = 'feratel-deskline';

  // Larger delay to be respectful — many regions to scrape
  protected delayMs = 500;

  // Max events per region to avoid overwhelming the API
  private maxEventsPerRegion = 500;

  // Track seen event IDs to deduplicate across regions
  private seenEventIds = new Set<string>();

  async scrape(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];
    const sessionId = generateSessionId();

    this.log(`Starting Feratel Deskline scrape across ${REGIONS.length} regions`);

    for (const region of REGIONS) {
      try {
        const events = await this.scrapeRegion(region, sessionId);
        allEvents.push(...events);
        this.log(`${region.name}: ${events.length} events (${this.seenEventIds.size} unique total)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`${region.name}: FEHLER - ${msg}`);
      }

      // Rate limit between regions
      await this.rateLimit();
    }

    this.log(`Feratel scrape complete: ${allEvents.length} events from ${REGIONS.length} regions`);
    return allEvents;
  }

  private async scrapeRegion(region: FeratelRegionConfig, sessionId: string): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    let pageNo = 0;
    let totalPages = 1;

    while (pageNo < totalPages) {
      const url = `${API_BASE}/${region.code}/de/events?fields=${EVENT_FIELDS}&sortingFields=date&pageNo=${pageNo}&pageSize=${PAGE_SIZE}`;

      const response = await this.fetchApi(url, sessionId);
      if (!response) break;

      totalPages = response.paging.pageCount;

      for (const event of response.data) {
        // Deduplicate: skip events we've already seen from another region
        if (this.seenEventIds.has(event.id)) continue;
        this.seenEventIds.add(event.id);

        const parsed = this.parseEvent(event, region);
        if (parsed) events.push(parsed);
      }

      // Respect max events per region
      if (events.length >= this.maxEventsPerRegion) {
        this.log(`${region.name}: reached max ${this.maxEventsPerRegion} events, stopping pagination`);
        break;
      }

      pageNo++;

      // Rate limit between pages
      if (pageNo < totalPages) {
        await this.sleep(300);
      }
    }

    return events;
  }

  private async fetchApi(url: string, sessionId: string): Promise<DesklineResponse | null> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'DW-Source': DW_SOURCE,
            'DW-SessionId': sessionId,
            'User-Agent': this.userAgent,
          },
        });

        if (response.status === 429) {
          // Rate limited — wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          this.log(`Rate limited, waiting ${retryAfter}s...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body.substring(0, 200)}`);
        }

        return (await response.json()) as DesklineResponse;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`API attempt ${attempt}/${this.maxRetries} failed: ${msg}`);

        if (attempt < this.maxRetries) {
          await this.sleep(this.delayMs * Math.pow(2, attempt - 1));
        }
      }
    }

    return null;
  }

  /**
   * Clean Deskline event titles that contain raw calendar metadata.
   * Some regions return names like:
   *   "8.4.2026Mi.16:00-18:00UhrKids Soul mit Sofie Amelie Mätzler"
   *   "Mi.19:00-UhrNutzung GemeindeInternÖFFENTLICHThis is some text..."
   * Strip date, day, time, visibility, and placeholder prefixes.
   */
  private cleanTitle(raw: string): string {
    let t = raw.trim();

    // Strip leading dates: "8.4.2026" or "30.5.2026"
    t = t.replace(/^\d{1,2}\.\d{1,2}\.\d{4}/g, '');

    // Strip leading day abbreviations: "Mo." "Di." "Mi." "Do." "Fr." "Sa." "So."
    // The trailing period is MANDATORY — without it the pattern would chop the
    // start off any word that begins with a day abbreviation:
    //   "Fronleichnam" → "onleichnam"  (Fr. of "Fronleichnam")
    //   "Frühschoppen" → "ühschoppen"
    //   "Salzburg"     → "lzburg"      (Sa. of "Salzburg")
    //   "Sommerfest"   → "mmerfest"    (So. of "Sommer")
    //   "Mittwochsmesse" → "ttwochsmesse"
    //   "Dorffest"     → "rffest"
    //   "Mondlauf"     → "ndlauf"
    // The Feratel raw titles that actually use this prefix always include the
    // period ("Mi.19:00-Uhr…", "Fr. 19:30 Konzert"), so requiring `\.` is safe.
    t = t.replace(/^(Mo|Di|Mi|Do|Fr|Sa|So)\.\s*/i, '');

    // Strip time ranges: "16:00-18:00Uhr" or "19:00-Uhr" or "14:00Uhr"
    t = t.replace(/\d{1,2}:\d{2}(-\d{1,2}:\d{2})?-?\s*Uhr/gi, '');

    // Strip repeated dates that appear mid-string
    t = t.replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, '');

    // Strip visibility markers: "InternÖFFENTLICH", "ÖFFENTLICH", "Intern"
    t = t.replace(/Intern(?:ÖFFENTLICH|öffentlich)?|ÖFFENTLICH|öffentlich/g, '');

    // Strip "This is some text..." placeholder
    t = t.replace(/This is some text[.…]*/gi, '');

    // Strip "Nutzung Gemeinde" prefix (internal booking label)
    t = t.replace(/^Nutzung\s+Gemeinde\s*/i, '');

    // Clean up leftover whitespace, dots, dashes at start
    t = t.replace(/^[\s.,\-:]+/, '').replace(/\s+/g, ' ').trim();

    return t;
  }

  private parseEvent(event: DesklineEvent, region: FeratelRegionConfig): ScrapedEvent | null {
    if (!event.name || !event.date) return null;

    const title = this.cleanTitle(event.name);
    if (title.length < 3) return null;

    // Parse date — API returns ISO format "2026-03-29T16:00:00"
    const startDate = event.date;

    // Location
    const loc = event.location;
    const place = loc?.place?.trim();
    const town = loc?.town?.trim();
    const locationName = [place, town].filter(Boolean).join(', ') || town || region.name;

    // Coordinates — use from API if available, otherwise fallback to region center
    const lat = loc?.coordinate?.lat ?? region.fallbackLat;
    const lng = loc?.coordinate?.long ?? region.fallbackLng;

    // Bundesland — derive from API regions data or use config
    const bundesland = mapBundesland(loc?.regions ?? null, region.bundesland);

    // Description
    let description: string | undefined;
    if (event.descriptions && event.descriptions.length > 0) {
      const raw = event.descriptions[0].description;
      if (raw) {
        description = stripHtml(raw);
        if (description.length > 1000) {
          description = description.substring(0, 997) + '...';
        }
      }
    }

    // Image URL
    let imageUrl: string | undefined;
    if (event.images && event.images.length > 0 && event.images[0].urls && event.images[0].urls.length > 0) {
      let url = event.images[0].urls[0];
      // Fix protocol-relative URLs
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      imageUrl = this.cleanImageUrl(url);
    }

    // Source URL — deliberately null.
    //
    // The Deskline API (webapi.deskline.net) requires a `DW-Source: desklineweb`
    // header and is not a user-facing page. Pointing source_url at the API
    // endpoint fails for both humans (404/400 in a browser) and for our
    // enrichment fetcher (which doesn't know about the auth header).
    //
    // Each region has its own user-facing portal (e.g. woerthersee.com,
    // salzkammergut.at, lungau.at) with URL patterns like
    //   /veranstaltungen/<slug>.html?tvbEventId=<id>
    // but the API response doesn't include a direct webUrl/portalUrl field
    // and portal URL patterns differ per region — not worth hard-coding a
    // region→portal mapping here.
    //
    // Downstream effect: the enrichment fetcher sees source_url=null and
    // skips the page-fetch step. Claude still classifies cleanly from
    // title + description + location + organizer metadata.
    //
    // The `urlFriendlyName` slug is dropped intentionally — not useful
    // without a portal domain to pin it to. Referenced here for future
    // work: once we have a region→portal-domain map, we can reconstruct
    // `https://{portal}.at/veranstaltung/{slug}` properly.
    // const slug = event.urlFriendlyName || event.id;
    const sourceUrl: string | null = null;

    // Category
    const category = categorizeEvent(title + ' ' + (description || ''));

    // Tags from event groups
    const tags: string[] = [];
    if (event.eventGroups) {
      for (const group of event.eventGroups) {
        if (group.name) tags.push(group.name);
      }
    }
    if (event.mainCriteria?.name) {
      tags.push(event.mainCriteria.name);
    }

    return {
      source_id: `feratel-${event.id}`,
      source_name: 'feratel-deskline',
      source_url: sourceUrl,
      title,
      description,
      start_date: startDate,
      location_name: locationName,
      latitude: lat,
      longitude: lng,
      bundesland,
      category,
      image_url: imageUrl,
      tags: tags.length > 0 ? tags : undefined,
    };
  }
}
