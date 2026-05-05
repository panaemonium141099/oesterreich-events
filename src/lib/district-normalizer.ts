/**
 * Canonical district normaliser. Keeps `events.district` consistent with
 * districtsAT.ts (lowercased) so the FilterDrawer chip + the API filter
 * can match by exact string equality.
 *
 * Mirrors the SQL migration 20260504220000_normalize_event_districts.sql
 * — the same alias map runs both at scrape-time (here) and as a one-shot
 * cleanup pass on the DB. If you add a new alias here, add it to the SQL
 * file too, otherwise existing rows stay misspelled.
 */
import { DISTRICTS_BY_BUNDESLAND, type BundeslandId } from './districtsAT';

export type CanonicalDistrict = string; // lowercased canonical name

/** Set of all valid canonical district names (lowercased). */
const CANONICAL_DISTRICTS: ReadonlySet<string> = new Set(
  Object.values(DISTRICTS_BY_BUNDESLAND)
    .flat()
    .map((d) => d.name.toLowerCase()),
);

/** Bundesland-scoped alias → canonical map. Keep in sync with the SQL migration. */
const ALIAS_MAP: Record<BundeslandId, Record<string, string>> = {
  burgenland: {
    'guessing': 'güssing',
    'neusiedl-am-see': 'neusiedl am see',
    'eisenstadt (stadt)': 'eisenstadt',
    'eisenstadt-umgebung': 'eisenstadt',
    'hartberg-fuerstenfeld': 'hartberg-fürstenfeld',
  },
  niederoesterreich: {
    'gaenserndorf': 'gänserndorf',
    'moedling': 'mödling',
    'gmuend': 'gmünd',
    'bruck/leitha': 'bruck an der leitha',
    'bruck-an-der-leitha': 'bruck an der leitha',
    'waidhofen/thaya': 'waidhofen an der thaya',
    'waidhofenthaya': 'waidhofen an der thaya',
    'krems an der donau (stadt)': 'krems (stadt)',
    'krems land': 'krems (land)',
    'krems': 'krems (land)',
    'wiener neustadt land': 'wiener neustadt (land)',
    'wiener-neustadt': 'wiener neustadt (stadt)',
    'st. pölten land': 'st. pölten (land)',
    'st-poelten': 'st. pölten (land)',
    'waidhofenybbstal': 'waidhofen an der ybbs',
  },
  oberoesterreich: {
    'voecklabruck': 'vöcklabruck',
    'schaerding': 'schärding',
    'gmuend': 'gmünd',
    'braunau/inn': 'braunau am inn',
    'braunau': 'braunau am inn',
    'ried/innkreis': 'ried im innkreis',
    'ried': 'ried im innkreis',
    'kirchdorf/krems': 'kirchdorf',
    'kirchdorf an der krems': 'kirchdorf',
    'steyr-steyr-land': 'steyr-land',
    'wels-wels-land': 'wels-land',
    'linz': 'linz (stadt)',
    'statutarstadt': 'linz (stadt)',
    'enns': 'linz-land',
    'grieskirchen-eferding': 'grieskirchen',
  },
  salzburg: {
    'salzburg': 'salzburg (stadt)',
    'salzburg-stadt': 'salzburg (stadt)',
    'st. johann/pongau': 'sankt johann im pongau',
    'pongau': 'sankt johann im pongau',
    'flachgau': 'salzburg-umgebung',
    'tennengau': 'hallein',
    'pinzgau': 'zell am see',
    'lungau': 'tamsweg',
  },
  steiermark: {
    'suedoststeiermark': 'südoststeiermark',
    'hartberg-fuerstenfeld': 'hartberg-fürstenfeld',
    'graz': 'graz (stadt)', // PLZ check below disambiguates land/stadt
    'bruck-an-der-mur': 'bruck-mürzzuschlag',
    'muerztal': 'bruck-mürzzuschlag',
  },
  kaernten: {
    'voelkermarkt': 'völkermarkt',
    'klagenfurt': 'klagenfurt (stadt)', // PLZ check
    'villach': 'villach (stadt)',       // PLZ check
    'spittal': 'spittal an der drau',
    'st. veit an der glan': 'sankt veit an der glan',
    'st-veit': 'sankt veit an der glan',
    'gailtal': 'hermagor',
    'lavanttal': 'wolfsberg',
  },
  tirol: {
    'kitzbuehel': 'kitzbühel',
    'innsbruck': 'innsbruck (stadt)', // PLZ check
    'osttirol': 'lienz',
    'hall-rum': 'innsbruck-land',
    'stubai-wipptal': 'innsbruck-land',
    'westliches-mittelgebirge': 'innsbruck-land',
    'telfs': 'innsbruck-land',
  },
  vorarlberg: {},
  wien: {
    'innere-stadt': '1. innere stadt',
    'leopoldstadt': '2. leopoldstadt',
    'landstrasse': '3. landstraße',
    'wieden': '4. wieden',
    'margareten': '5. margareten',
    'mariahilf': '6. mariahilf',
    'neubau': '7. neubau',
    'josefstadt': '8. josefstadt',
    'alsergrund': '9. alsergrund',
    'favoriten': '10. favoriten',
    'simmering': '11. simmering',
    'meidling': '12. meidling',
    'hietzing': '13. hietzing',
    'penzing': '14. penzing',
    'rudolfsheim-fuenfhaus': '15. rudolfsheim-fünfhaus',
    'ottakring': '16. ottakring',
    'hernals': '17. hernals',
    'waehring': '18. währing',
    'doebling': '19. döbling',
    'brigittenau': '20. brigittenau',
    'floridsdorf': '21. floridsdorf',
    'donaustadt': '22. donaustadt',
    'liesing': '23. liesing',
  },
};

/**
 * PLZ-based stadt/land disambiguation. When a Statutarstadt name appears
 * without the "(stadt)" / "-land" suffix and the PLZ falls outside the
 * Stadt-PLZ block, we route it to the surrounding Land-Bezirk instead of
 * letting the alias map promote it to "(stadt)".
 */
const STADT_PLZ: Record<string, { stadtPLZ: ReadonlySet<string>; landDistrict: string; bl: BundeslandId }> = {
  'graz': { stadtPLZ: new Set(['8010','8011','8013','8020','8021','8036','8041','8042','8043','8044','8045','8046','8047','8051','8052','8053','8054','8055','8063','8070','8071','8072','8073','8074','8075','8076','8077']), landDistrict: 'graz-umgebung', bl: 'steiermark' },
  'linz': { stadtPLZ: new Set(['4010','4020','4030','4040','4050']), landDistrict: 'linz-land', bl: 'oberoesterreich' },
  'statutarstadt': { stadtPLZ: new Set(['4010','4020','4030','4040','4050']), landDistrict: 'linz-land', bl: 'oberoesterreich' },
  'klagenfurt': { stadtPLZ: new Set(['9010','9020','9061','9062','9063']), landDistrict: 'klagenfurt-land', bl: 'kaernten' },
  'villach': { stadtPLZ: new Set(['9500','9504','9505','9506','9507','9508']), landDistrict: 'villach-land', bl: 'kaernten' },
  'innsbruck': { stadtPLZ: new Set(['6010','6015','6020']), landDistrict: 'innsbruck-land', bl: 'tirol' },
  'wiener-neustadt': { stadtPLZ: new Set(['2700']), landDistrict: 'wiener neustadt (land)', bl: 'niederoesterreich' },
  'st-poelten': { stadtPLZ: new Set(['3100']), landDistrict: 'st. pölten (land)', bl: 'niederoesterreich' },
};

/**
 * Normalise a raw district string. Returns the canonical lowercase name
 * if the alias is recognised, or the lowercased input passed through
 * untouched (so unknown values aren't silently destroyed — they show up
 * as residual aliases in the next normalisation report).
 *
 * `bundesland` and `postalCode` are required for stadt/land
 * disambiguation; pass them whenever available.
 */
export function normalizeDistrict(
  district: string | null | undefined,
  bundesland: string | null | undefined,
  postalCode?: string | null,
): string | null {
  if (!district || !district.trim()) return null;
  const raw = district.trim().toLowerCase();
  const blId = (bundesland ?? '').trim().toLowerCase() as BundeslandId;

  // Stadt/Land disambiguation runs first — overrides the alias map.
  const stadtRule = STADT_PLZ[raw];
  if (stadtRule && stadtRule.bl === blId && postalCode && !stadtRule.stadtPLZ.has(postalCode.trim())) {
    return stadtRule.landDistrict;
  }

  // Bundesland-scoped alias map.
  const aliases = blId in ALIAS_MAP ? ALIAS_MAP[blId] : undefined;
  if (aliases && raw in aliases) {
    return aliases[raw];
  }

  // Already canonical → keep.
  return raw;
}

export function isCanonicalDistrict(district: string): boolean {
  return CANONICAL_DISTRICTS.has(district.trim().toLowerCase());
}
