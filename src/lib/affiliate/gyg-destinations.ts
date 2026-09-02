/**
 * GetYourGuide-Zielorte (fn-22) — welche Orte ueberhaupt Angebot haben.
 *
 * GYG hat in Oesterreich kein flaechendeckendes Inventar: die Plattform
 * kennt rund zwei Dutzend Ziele, der Rest des Landes ist leer. Eine Box
 * "Touren in X" auf einer Gemeindeseite ohne einziges Angebot kostet
 * Vertrauen und bringt nichts — deshalb entscheidet diese Tabelle, wo
 * ueberhaupt verlinkt wird.
 *
 * HERKUNFT DER ZAHLEN: `activities` ist die Ergebniszahl, die die
 * jeweilige Zielseite auf getyourguide.de am `VERIFIED_AT` selbst
 * angezeigt hat (Live-Abruf, nicht geschaetzt). Bad Gastein stand mit
 * 0 Ergebnissen da und fehlt hier bewusst — es ist der einzige Ort aus
 * GYGs eigener Oesterreich-Top-20, der komplett leer ist.
 *
 * ERWEITERN: Zielseite oeffnen, angezeigte Ergebniszahl ablesen, Zeile
 * mit dieser Zahl und neuem VERIFIED_AT ergaenzen. Keine Eintraege ohne
 * gezaehltes Angebot.
 */

import { deriveCityFromLocation } from '@/lib/booking/affiliate';

/** Tag, an dem die Angebotszahlen live abgelesen wurden. */
export const VERIFIED_AT = '2026-09-02';

export interface GygDestination {
  /** Anzeigename in der Box ("Zell am See"). */
  name: string;
  /** Pfad auf getyourguide.de ohne Slashes ("zell-am-see-l104073"). */
  path: string;
  /** Am VERIFIED_AT gezaehlte Angebote. 500 = "500+". */
  activities: number;
  /** Ort vs. Region — steuert nur die Ueberschrift der Box. */
  kind: 'city' | 'region';
  /** Zusaetzliche Schreibweisen, unter denen der Ort bei uns auftaucht. */
  aliases?: string[];
}

/**
 * Schluessel-Normalisierung. Faltet Diakritika UND die ausgeschriebenen
 * Umlaute, damit "Sölden" (Event-Adresse) und "soelden" (unser
 * Gemeinde-Slug) auf denselben Schluessel fallen.
 */
export function gygKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u00df/g, 'ss')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Orte mit eigener GYG-Zielseite. Reihenfolge = Angebotsmenge, rein
 * zur Lesbarkeit.
 */
export const GYG_CITIES: GygDestination[] = [
  { name: 'Wien', path: 'wien-l7', activities: 500, kind: 'city', aliases: ['vienna'] },
  { name: 'Salzburg', path: 'salzburg-l4', activities: 234, kind: 'city' },
  { name: 'Hallstatt', path: 'hallstatt-l32535', activities: 114, kind: 'city' },
  {
    name: 'Krems an der Donau',
    path: 'krems-an-der-donau-l154016',
    activities: 86,
    kind: 'city',
    aliases: ['krems'],
  },
  { name: 'Innsbruck', path: 'innsbruck-l164', activities: 82, kind: 'city' },
  { name: 'Melk', path: 'melk-l3461', activities: 60, kind: 'city' },
  { name: 'Graz', path: 'graz-l32599', activities: 34, kind: 'city' },
  { name: 'Bad Ischl', path: 'bad-ischl-l152332', activities: 19, kind: 'city' },
  { name: 'Linz', path: 'linz-l3463', activities: 18, kind: 'city' },
  { name: 'Bregenz', path: 'bregenz-l146725', activities: 18, kind: 'city' },
  { name: 'Zell am See', path: 'zell-am-see-l104073', activities: 13, kind: 'city' },
  { name: 'Mayrhofen', path: 'mayrhofen-l140066', activities: 9, kind: 'city' },
  {
    name: 'Seefeld',
    path: 'seefeld-l837',
    activities: 9,
    kind: 'city',
    aliases: ['seefeld in tirol'],
  },
  { name: 'Villach', path: 'villach-l140041', activities: 8, kind: 'city' },
  { name: 'Kitzbühel', path: 'kitzbuhel-l140056', activities: 7, kind: 'city' },
  { name: 'Eisenstadt', path: 'eisenstadt-l1155', activities: 6, kind: 'city' },
  { name: 'Kaprun', path: 'kaprun-l116372', activities: 5, kind: 'city' },
  { name: 'Sölden', path: 'solden-l149759', activities: 5, kind: 'city' },
  {
    name: 'Klagenfurt',
    path: 'klagenfurt-l3',
    activities: 5,
    kind: 'city',
    aliases: ['klagenfurt am wörthersee'],
  },
  {
    name: 'Saalbach-Hinterglemm',
    path: 'saalbach-hinterglemm-l156448',
    activities: 1,
    kind: 'city',
    aliases: ['saalbach', 'hinterglemm'],
  },
];

/**
 * Bundesland-Fallback fuer alle Orte ohne eigene Zielseite — und das
 * sind fast alle unserer ~2.000 Gemeinden. Jede Region hat nachgezaehlt
 * echtes Angebot, die Box laeuft damit nie ins Leere.
 *
 * Salzburg-Land zeigt bewusst auf die Stadt-Seite: eine eigene
 * Bundesland-Zielseite fuehrt GYG in seiner Oesterreich-Uebersicht nicht,
 * und die Stadt ist der Ausgangspunkt praktisch aller Touren im Land.
 */
export const GYG_REGIONS: Record<string, GygDestination> = {
  wien: { name: 'Wien', path: 'wien-l7', activities: 500, kind: 'region' },
  oberosterreich: {
    name: 'Oberösterreich',
    path: 'oberosterreich-l218',
    activities: 355,
    kind: 'region',
  },
  niederosterreich: {
    name: 'Niederösterreich',
    path: 'niederosterreich-l2387',
    activities: 346,
    kind: 'region',
  },
  salzburg: { name: 'Salzburg', path: 'salzburg-l4', activities: 234, kind: 'region' },
  tirol: { name: 'Tirol', path: 'tirol-l5', activities: 202, kind: 'region' },
  steiermark: { name: 'Steiermark', path: 'steiermark-l4604', activities: 120, kind: 'region' },
  vorarlberg: { name: 'Vorarlberg', path: 'vorarlberg-l6', activities: 42, kind: 'region' },
  burgenland: { name: 'Burgenland', path: 'burgenland-l215', activities: 29, kind: 'region' },
  karnten: { name: 'Kärnten', path: 'karnten-l256', activities: 23, kind: 'region' },
};

/** Lookup-Index: normalisierter Name/Alias -> Ziel. Einmalig gebaut. */
const CITY_INDEX: Map<string, GygDestination> = (() => {
  const index = new Map<string, GygDestination>();
  for (const dest of GYG_CITIES) {
    index.set(gygKey(dest.name), dest);
    for (const alias of dest.aliases ?? []) index.set(gygKey(alias), dest);
  }
  return index;
})();

/** Ort -> Zielseite. Nur exakte Treffer: "Wiener Neustadt" ist nicht Wien. */
export function findGygCity(city: string | null | undefined): GygDestination | null {
  const key = gygKey(city ?? '');
  if (!key) return null;
  return CITY_INDEX.get(key) ?? null;
}

/** Bundesland -> Regions-Zielseite. */
export function findGygRegion(bundesland: string | null | undefined): GygDestination | null {
  const key = gygKey(bundesland ?? '');
  if (!key) return null;
  return GYG_REGIONS[key] ?? null;
}

export interface GygResolveInput {
  /** Bereits sauberer Ortsname, wenn die Seite einen hat (Gemeinde-Hub). */
  city?: string | null;
  /** Adress-Freitext ("Theaterplatz 7, 2500 Baden, Niederösterreich"). */
  address?: string | null;
  /** Veranstaltungsort-Name, oft mit Ort dahinter. */
  locationName?: string | null;
  /** Bundesland fuer den Fallback, wenn der Ort kein eigenes Ziel hat. */
  bundesland?: string | null;
}

/**
 * Ort -> Zielseite, mit Bundesland als Auffangnetz.
 *
 * Der Adress-Parser kommt aus dem Booking-Modul: er ist getestet, kennt
 * das PLZ+Stadt-Muster und wirft Muell wie Emojis im Adressfeld raus
 * (Live-Befund aus fn-21). Ihn hier zu duplizieren hiesse, denselben
 * Bugreport ein zweites Mal einzusammeln.
 */
export function resolveGygDestination(input: GygResolveInput): GygDestination | null {
  const city =
    findGygCity(input.city) ||
    findGygCity(deriveCityFromLocation(input.address)) ||
    findGygCity(deriveCityFromLocation(input.locationName));
  if (city) return city;
  return findGygRegion(input.bundesland);
}

/**
 * Ab wie vielen Angeboten das echte Widget ausgeliefert wird — getrennt
 * fuer Orte und Regionen, weil die Zahlen nicht vergleichbar sind.
 *
 * WARUM UEBERHAUPT EINE SCHWELLE: Das auto-Widget sucht sein Angebot
 * selbst. Findet es vor Ort nichts, fuellt es mit irgendetwas auf der
 * Welt auf — auf der Pinkafeld-Seite standen unter der Ueberschrift
 * "Touren & Aktivitaeten in Burgenland" ein Pinball-Museum und eine
 * Pinguin-Parade (Melbourne). Deshalb laeuft das Widget nur dort, wo GYG
 * nachweislich Programm hat; ueberall sonst bleibt der ehrliche Link.
 */
export const WIDGET_MIN_CITY_ACTIVITIES = 30;
export const WIDGET_MIN_REGION_ACTIVITIES = 100;

/**
 * GYG-Location-ID aus dem Pfad ("wien-l7" -> 7). Das Staedte-Widget
 * adressiert Orte ueber diese Zahl, nicht ueber den Slug.
 */
export function gygLocationId(destination: Pick<GygDestination, 'path'>): number | null {
  const match = destination.path.match(/-l(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Traegt das Ziel genug Angebot fuer das Widget? */
export function qualifiesForWidget(destination: GygDestination): boolean {
  return destination.kind === 'city'
    ? destination.activities >= WIDGET_MIN_CITY_ACTIVITIES
    : destination.activities >= WIDGET_MIN_REGION_ACTIVITIES;
}
