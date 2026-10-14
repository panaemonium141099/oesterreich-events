/**
 * Liegt eine Adresse in dem Ort, den die Quelle nennt?
 *
 * Anlass (Prod 2026-10-14): Feratel-Detailseiten führen als
 * Veranstaltungsort teils die Büroadresse des Veranstalters („Europolis
 * Entertainment, Hollergasse 32/6, 1150 Wien" für ein Konzert im
 * Konzerthaus Klagenfurt). Mit der PLZ 1150 landete das Konzert in Wien.
 * Eine Adresse gehört nur dann zum Event, wenn sie in der genannten
 * Gemeinde liegt.
 *
 * SERVER-ONLY (Gemeinde-Stammdatei).
 */
import { gemeindenByPlz, gemeindenNamedByPlaceText, isKnownAustrianPlz, normalizeGemeindeName } from './gemeinde-index';

export type PlaceRelation = 'same' | 'different' | 'unknown';

/** Österreichische PLZ aus einem Adressfeld („9020", „A-9020"), sonst null. */
export function austrianPlz(zip: string | null | undefined): string | null {
  const m = /^(?:A|AT)?\s*-?\s*(\d{4})$/i.exec(zip?.trim() ?? '');
  return m && isKnownAustrianPlz(m[1]) ? m[1] : null;
}

/** Gleiche Wörter, eines davon abgekürzt: „Wald a. Arlberg" = „Wald am Arlberg". */
function sameWordsAbbreviated(x: string, y: string): boolean {
  const a = x.split(' ');
  const b = y.split(' ');
  return a.length === b.length && a[0] === b[0] && a.every((w, i) => w.startsWith(b[i]) || b[i].startsWith(w));
}

/** Zwei Ortsangaben (oder ihre Teile, „Lech am Arlberg / Oberlech") sind
 *  wortgleich, abgekürzt gleich, oder eine beginnt mit der anderen
 *  („Seefeld" / „Seefeld in Tirol", nicht „Raurisertal" / „Rauris"). */
function sameWording(a: string, b: string): boolean {
  const variants = (s: string) => [s, ...s.split('/')].map(p => normalizeGemeindeName(p)).filter(Boolean);
  return variants(a).some(x => variants(b).some(y =>
    x === y || x.replace(/ /g, '') === y.replace(/ /g, '') || x.startsWith(`${y} `) || y.startsWith(`${x} `) || sameWordsAbbreviated(x, y),
  ));
}

/**
 * Verhältnis einer Adresse (`postal_code`, sonst `city`) zum genannten Ort:
 *
 *  - `same`: die PLZ (ohne PLZ der Ortsname) gehört zu einer Gemeinde, die
 *    der genannte Ort meint, oder beide Angaben sind wortgleich.
 *  - `different`: die Adresse liegt nachweislich woanders (andere Gemeinde,
 *    ausländische PLZ, oder bei einem nicht amtlichen Ortsnamen ein anderes
 *    als das genannte Bundesland).
 *  - `unknown`: nicht entscheidbar (Ortsname nicht in der Stammdatei,
 *    Adresse ohne verwertbare PLZ und ohne bekannten Ort).
 */
export function addressPlaceRelation(
  namedPlace: string,
  address: { postal_code?: string | null; city?: string | null },
  bundesland?: string | null,
): PlaceRelation {
  const plz = austrianPlz(address.postal_code);
  const foreignPlz = !plz && !!address.postal_code?.trim();
  const addressRefs = plz ? gemeindenByPlz(plz) : gemeindenNamedByPlaceText(address.city, bundesland);
  const placeRefs = gemeindenNamedByPlaceText(namedPlace, bundesland);

  if (placeRefs.length > 0) {
    if (addressRefs.length > 0) return addressRefs.some(r => placeRefs.includes(r)) ? 'same' : 'different';
    return foreignPlz ? 'different' : 'unknown';
  }
  // Ort nicht in der Stammdatei (Tourismus- oder Ortsteilname).
  if (address.city && sameWording(namedPlace, address.city)) return 'same';
  if (foreignPlz) return 'different';
  if (bundesland && addressRefs.length > 0 && !addressRefs.some(r => r.bundesland === bundesland)) return 'different';
  return 'unknown';
}
