/**
 * Tourismusregionen der Seiten „Was kann man in X machen?" (/was-tun/[slug]).
 *
 * Eine Region hat keine eigenen Koordinaten: sie hängt an einer Gemeinde der
 * Stammdaten (`anchor` = Slug aus data/gemeinden-at.json) und einem Umkreis.
 * Die Seite zeigt, was in diesem Umkreis liegt, und sagt das auch so. Damit
 * bleibt es bei EINEM Ortsdaten-System (fn-27): keine zweite Koordinatenliste.
 *
 * `where` ist die fertige Ortsangabe mit Präposition („im Salzkammergut",
 * „am Achensee"), weil sie sich nicht aus dem Namen ableiten lässt.
 *
 * Nicht dabei: Landesportale (das sind die Bundesland-Seiten) und Regionen,
 * die nur aus einer Gemeinde bestehen (die hat ihre Gemeinde-Seite).
 * Wächter: src/__tests__/lib/was-tun/regions.test.ts (jeder Anker existiert,
 * Slugs eindeutig und ohne Kollision mit Bundesland oder Gemeinde).
 */

export interface TourismRegion {
  /** URL-Segment unter /was-tun/. */
  slug: string;
  name: string;
  /** Ortsangabe mit Präposition, klein beginnend: „im Salzkammergut". */
  where: string;
  /** Bundesland-ID (wie BUNDESLAENDER). */
  bundesland: string;
  /** Slug der Anker-Gemeinde (Mittelpunkt des Umkreises). */
  anchor: string;
  radiusKm: number;
}

export const TOURISM_REGIONS: readonly TourismRegion[] = [
  // Burgenland
  { slug: 'neusiedler-see', name: 'Neusiedler See', where: 'am Neusiedler See', bundesland: 'burgenland', anchor: '7141-podersdorf-am-see', radiusKm: 25 },
  { slug: 'suedburgenland', name: 'Südburgenland', where: 'im Südburgenland', bundesland: 'burgenland', anchor: '7540-guessing', radiusKm: 30 },
  // Niederösterreich
  { slug: 'waldviertel', name: 'Waldviertel', where: 'im Waldviertel', bundesland: 'niederoesterreich', anchor: '3910-zwettl-niederoesterreich', radiusKm: 40 },
  { slug: 'weinviertel', name: 'Weinviertel', where: 'im Weinviertel', bundesland: 'niederoesterreich', anchor: '2130-mistelbach', radiusKm: 40 },
  { slug: 'mostviertel', name: 'Mostviertel', where: 'im Mostviertel', bundesland: 'niederoesterreich', anchor: '3270-scheibbs', radiusKm: 35 },
  { slug: 'wachau', name: 'Wachau', where: 'in der Wachau', bundesland: 'niederoesterreich', anchor: '3601-duernstein', radiusKm: 15 },
  { slug: 'wiener-alpen', name: 'Wiener Alpen', where: 'in den Wiener Alpen', bundesland: 'niederoesterreich', anchor: '2620-neunkirchen', radiusKm: 30 },
  { slug: 'wienerwald', name: 'Wienerwald', where: 'im Wienerwald', bundesland: 'niederoesterreich', anchor: '3021-pressbaum', radiusKm: 25 },
  // Oberösterreich
  { slug: 'salzkammergut', name: 'Salzkammergut', where: 'im Salzkammergut', bundesland: 'oberoesterreich', anchor: '4820-bad-ischl', radiusKm: 30 },
  { slug: 'muehlviertel', name: 'Mühlviertel', where: 'im Mühlviertel', bundesland: 'oberoesterreich', anchor: '4240-freistadt', radiusKm: 35 },
  { slug: 'donauregion-oberoesterreich', name: 'Donauregion Oberösterreich', where: 'in der Donauregion Oberösterreich', bundesland: 'oberoesterreich', anchor: '4360-grein', radiusKm: 30 },
  { slug: 'pyhrn-priel', name: 'Pyhrn-Priel', where: 'in der Region Pyhrn-Priel', bundesland: 'oberoesterreich', anchor: '4580-windischgarsten', radiusKm: 25 },
  { slug: 'innviertel', name: 'Innviertel', where: 'im Innviertel', bundesland: 'oberoesterreich', anchor: '4910-ried-im-innkreis', radiusKm: 35 },
  // Salzburg
  { slug: 'salzburger-seenland', name: 'Salzburger Seenland', where: 'im Salzburger Seenland', bundesland: 'salzburg', anchor: '5163-mattsee', radiusKm: 12 },
  { slug: 'fuschlsee', name: 'Fuschlsee', where: 'am Fuschlsee', bundesland: 'salzburg', anchor: '5330-fuschl-am-see', radiusKm: 10 },
  { slug: 'wolfgangsee', name: 'Wolfgangsee', where: 'am Wolfgangsee', bundesland: 'salzburg', anchor: '5360-st-wolfgang-im-salzkammergut', radiusKm: 12 },
  { slug: 'tennengau', name: 'Tennengau', where: 'im Tennengau', bundesland: 'salzburg', anchor: '5400-hallein', radiusKm: 20 },
  { slug: 'salzburger-sonnenterrasse', name: 'Salzburger Sonnenterrasse', where: 'auf der Salzburger Sonnenterrasse', bundesland: 'salzburg', anchor: '5621-st-veit-im-pongau', radiusKm: 10 },
  { slug: 'hochkoenig', name: 'Hochkönig', where: 'am Hochkönig', bundesland: 'salzburg', anchor: '5505-muehlbach-am-hochkoenig', radiusKm: 12 },
  { slug: 'salzburger-sportwelt', name: 'Salzburger Sportwelt', where: 'in der Salzburger Sportwelt', bundesland: 'salzburg', anchor: '5541-altenmarkt-im-pongau', radiusKm: 20 },
  { slug: 'obertauern', name: 'Obertauern', where: 'in Obertauern', bundesland: 'salzburg', anchor: '5561-untertauern', radiusKm: 12 },
  { slug: 'gasteinertal', name: 'Gasteinertal', where: 'im Gasteinertal', bundesland: 'salzburg', anchor: '5630-bad-hofgastein', radiusKm: 15 },
  { slug: 'grossarltal', name: 'Großarltal', where: 'im Großarltal', bundesland: 'salzburg', anchor: '5611-grossarl', radiusKm: 12 },
  { slug: 'salzburger-saalachtal', name: 'Salzburger Saalachtal', where: 'im Salzburger Saalachtal', bundesland: 'salzburg', anchor: '5090-lofer', radiusKm: 12 },
  { slug: 'zell-am-see-kaprun', name: 'Zell am See-Kaprun', where: 'in Zell am See-Kaprun', bundesland: 'salzburg', anchor: '5700-zell-am-see', radiusKm: 12 },
  { slug: 'saalfelden-leogang', name: 'Saalfelden Leogang', where: 'in Saalfelden Leogang', bundesland: 'salzburg', anchor: '5760-saalfelden-am-steinernen-meer', radiusKm: 12 },
  { slug: 'nationalpark-hohe-tauern-salzburg', name: 'Nationalpark Hohe Tauern (Salzburg)', where: 'im Nationalpark Hohe Tauern in Salzburg', bundesland: 'salzburg', anchor: '5730-mittersill', radiusKm: 30 },
  { slug: 'wildkogel-arena', name: 'Wildkogel-Arena', where: 'in der Wildkogel-Arena', bundesland: 'salzburg', anchor: '5741-neukirchen-am-grossvenediger', radiusKm: 12 },
  { slug: 'lungau', name: 'Lungau', where: 'im Lungau', bundesland: 'salzburg', anchor: '5580-tamsweg', radiusKm: 20 },
  // Steiermark
  { slug: 'schladming-dachstein', name: 'Schladming-Dachstein', where: 'in der Region Schladming-Dachstein', bundesland: 'steiermark', anchor: '8970-schladming', radiusKm: 20 },
  { slug: 'ausseerland', name: 'Ausseerland', where: 'im Ausseerland', bundesland: 'steiermark', anchor: '8990-bad-aussee', radiusKm: 15 },
  { slug: 'gesaeuse', name: 'Gesäuse', where: 'im Gesäuse', bundesland: 'steiermark', anchor: '8911-admont', radiusKm: 20 },
  { slug: 'hochsteiermark', name: 'Hochsteiermark', where: 'in der Hochsteiermark', bundesland: 'steiermark', anchor: '8600-bruck-an-der-mur', radiusKm: 30 },
  { slug: 'erzberg-leoben', name: 'Erzberg Leoben', where: 'in der Region Erzberg Leoben', bundesland: 'steiermark', anchor: '8700-leoben', radiusKm: 20 },
  { slug: 'murtal', name: 'Murtal', where: 'im Murtal', bundesland: 'steiermark', anchor: '8750-judenburg', radiusKm: 25 },
  { slug: 'region-murau', name: 'Region Murau', where: 'in der Region Murau', bundesland: 'steiermark', anchor: '8850-murau', radiusKm: 25 },
  { slug: 'oststeiermark', name: 'Oststeiermark', where: 'in der Oststeiermark', bundesland: 'steiermark', anchor: '8230-hartberg', radiusKm: 30 },
  { slug: 'suedsteiermark', name: 'Südsteiermark', where: 'in der Südsteiermark', bundesland: 'steiermark', anchor: '8430-leibnitz', radiusKm: 25 },
  { slug: 'thermen-und-vulkanland', name: 'Thermen- und Vulkanland', where: 'im Thermen- und Vulkanland', bundesland: 'steiermark', anchor: '8330-feldbach', radiusKm: 25 },
  // Kärnten
  { slug: 'woerthersee', name: 'Wörthersee', where: 'am Wörthersee', bundesland: 'kaernten', anchor: '9210-poertschach-am-woerther-see', radiusKm: 15 },
  { slug: 'faaker-see-ossiacher-see', name: 'Faaker See und Ossiacher See', where: 'am Faaker See und Ossiacher See', bundesland: 'kaernten', anchor: '9500-villach', radiusKm: 15 },
  { slug: 'nassfeld-pressegger-see', name: 'Nassfeld und Pressegger See', where: 'am Nassfeld und Pressegger See', bundesland: 'kaernten', anchor: '9620-hermagor-pressegger-see', radiusKm: 20 },
  { slug: 'millstaetter-see', name: 'Millstätter See', where: 'am Millstätter See', bundesland: 'kaernten', anchor: '9872-millstatt-am-see', radiusKm: 15 },
  { slug: 'nationalpark-hohe-tauern-kaernten', name: 'Nationalpark Hohe Tauern (Kärnten)', where: 'im Nationalpark Hohe Tauern in Kärnten', bundesland: 'kaernten', anchor: '9844-heiligenblut-am-grossglockner', radiusKm: 25 },
  { slug: 'mittelkaernten', name: 'Mittelkärnten', where: 'in Mittelkärnten', bundesland: 'kaernten', anchor: '9300-st-veit-an-der-glan', radiusKm: 25 },
  { slug: 'klopeiner-see-suedkaernten', name: 'Klopeiner See und Südkärnten', where: 'am Klopeiner See und in Südkärnten', bundesland: 'kaernten', anchor: '9122-st-kanzian-am-klopeiner-see', radiusKm: 25 },
  { slug: 'katschberg', name: 'Katschberg', where: 'am Katschberg', bundesland: 'kaernten', anchor: '9863-rennweg-am-katschberg', radiusKm: 12 },
  // Tirol
  { slug: 'achensee', name: 'Achensee', where: 'am Achensee', bundesland: 'tirol', anchor: '6212-eben-am-achensee', radiusKm: 12 },
  { slug: 'alpbachtal', name: 'Alpbachtal', where: 'im Alpbachtal', bundesland: 'tirol', anchor: '6236-alpbach', radiusKm: 12 },
  { slug: 'zillertal', name: 'Zillertal', where: 'im Zillertal', bundesland: 'tirol', anchor: '6280-zell-am-ziller', radiusKm: 20 },
  { slug: 'tux-finkenberg', name: 'Tux-Finkenberg', where: 'in Tux-Finkenberg', bundesland: 'tirol', anchor: '6293-tux', radiusKm: 10 },
  { slug: 'kufsteinerland', name: 'Kufsteinerland', where: 'im Kufsteinerland', bundesland: 'tirol', anchor: '6330-kufstein', radiusKm: 12 },
  { slug: 'hohe-salve', name: 'Hohe Salve', where: 'in der Ferienregion Hohe Salve', bundesland: 'tirol', anchor: '6361-hopfgarten-im-brixental', radiusKm: 12 },
  { slug: 'naturparkregion-reutte', name: 'Naturparkregion Reutte', where: 'in der Naturparkregion Reutte', bundesland: 'tirol', anchor: '6600-reutte', radiusKm: 12 },
  { slug: 'region-st-johann-in-tirol', name: 'Region St. Johann in Tirol', where: 'in der Region St. Johann in Tirol', bundesland: 'tirol', anchor: '6380-st-johann-in-tirol', radiusKm: 12 },
  { slug: 'imst-gurgltal', name: 'Imst und Gurgltal', where: 'in Imst und im Gurgltal', bundesland: 'tirol', anchor: '6460-imst', radiusKm: 12 },
  { slug: 'kaiserwinkl', name: 'Kaiserwinkl', where: 'im Kaiserwinkl', bundesland: 'tirol', anchor: '6345-koessen', radiusKm: 12 },
  { slug: 'brixental', name: 'Brixental', where: 'im Brixental', bundesland: 'tirol', anchor: '6364-brixen-im-thale', radiusKm: 12 },
  { slug: 'lechtal', name: 'Lechtal', where: 'im Lechtal', bundesland: 'tirol', anchor: '6652-elbigenalp', radiusKm: 20 },
  { slug: 'region-seefeld', name: 'Region Seefeld', where: 'in der Region Seefeld', bundesland: 'tirol', anchor: '6100-seefeld-in-tirol', radiusKm: 12 },
  { slug: 'osttirol', name: 'Osttirol', where: 'in Osttirol', bundesland: 'tirol', anchor: '9900-lienz', radiusKm: 30 },
  { slug: 'oetztal', name: 'Ötztal', where: 'im Ötztal', bundesland: 'tirol', anchor: '6444-laengenfeld', radiusKm: 25 },
  { slug: 'paznaun', name: 'Paznaun', where: 'im Paznaun', bundesland: 'tirol', anchor: '6561-ischgl', radiusKm: 15 },
  { slug: 'pillerseetal', name: 'Pillerseetal', where: 'im Pillerseetal', bundesland: 'tirol', anchor: '6391-fieberbrunn', radiusKm: 12 },
  { slug: 'pitztal', name: 'Pitztal', where: 'im Pitztal', bundesland: 'tirol', anchor: '6481-st-leonhard-im-pitztal', radiusKm: 20 },
  { slug: 'hall-wattens', name: 'Region Hall-Wattens', where: 'in der Region Hall-Wattens', bundesland: 'tirol', anchor: '6060-hall-in-tirol', radiusKm: 10 },
  { slug: 'serfaus-fiss-ladis', name: 'Serfaus-Fiss-Ladis', where: 'in Serfaus-Fiss-Ladis', bundesland: 'tirol', anchor: '6534-serfaus', radiusKm: 10 },
  { slug: 'silberregion-karwendel', name: 'Silberregion Karwendel', where: 'in der Silberregion Karwendel', bundesland: 'tirol', anchor: '6130-schwaz', radiusKm: 12 },
  { slug: 'stubaital', name: 'Stubaital', where: 'im Stubaital', bundesland: 'tirol', anchor: '6167-neustift-im-stubaital', radiusKm: 15 },
  { slug: 'tannheimer-tal', name: 'Tannheimer Tal', where: 'im Tannheimer Tal', bundesland: 'tirol', anchor: '6675-tannheim', radiusKm: 10 },
  { slug: 'tirolwest', name: 'TirolWest', where: 'in der Ferienregion TirolWest', bundesland: 'tirol', anchor: '6500-landeck', radiusKm: 10 },
  { slug: 'tiroler-oberland', name: 'Tiroler Oberland', where: 'im Tiroler Oberland', bundesland: 'tirol', anchor: '6531-ried-im-oberinntal', radiusKm: 20 },
  { slug: 'tiroler-zugspitz-arena', name: 'Tiroler Zugspitz Arena', where: 'in der Tiroler Zugspitz Arena', bundesland: 'tirol', anchor: '6632-ehrwald', radiusKm: 12 },
  { slug: 'mieminger-plateau', name: 'Mieminger Plateau', where: 'am Mieminger Plateau', bundesland: 'tirol', anchor: '6414-mieming', radiusKm: 10 },
  { slug: 'wilder-kaiser', name: 'Wilder Kaiser', where: 'am Wilden Kaiser', bundesland: 'tirol', anchor: '6352-ellmau', radiusKm: 12 },
  { slug: 'wipptal', name: 'Wipptal', where: 'im Wipptal', bundesland: 'tirol', anchor: '6150-steinach-am-brenner', radiusKm: 15 },
  // Vorarlberg
  { slug: 'bodensee-vorarlberg', name: 'Bodensee-Vorarlberg', where: 'am Bodensee in Vorarlberg', bundesland: 'vorarlberg', anchor: '6900-bregenz', radiusKm: 15 },
  { slug: 'bregenzerwald', name: 'Bregenzerwald', where: 'im Bregenzerwald', bundesland: 'vorarlberg', anchor: '6866-andelsbuch', radiusKm: 20 },
  { slug: 'montafon', name: 'Montafon', where: 'im Montafon', bundesland: 'vorarlberg', anchor: '6780-schruns', radiusKm: 20 },
  { slug: 'kleinwalsertal', name: 'Kleinwalsertal', where: 'im Kleinwalsertal', bundesland: 'vorarlberg', anchor: '6991-mittelberg', radiusKm: 10 },
  { slug: 'alpenregion-bludenz', name: 'Alpenregion Bludenz', where: 'in der Alpenregion Bludenz', bundesland: 'vorarlberg', anchor: '6700-bludenz', radiusKm: 15 },
  { slug: 'arlberg', name: 'Arlberg', where: 'am Arlberg', bundesland: 'vorarlberg', anchor: '6764-lech', radiusKm: 15 },
];

const BY_SLUG = new Map(TOURISM_REGIONS.map((r) => [r.slug, r]));

export function tourismRegionBySlug(slug: string): TourismRegion | null {
  return BY_SLUG.get(slug) ?? null;
}
