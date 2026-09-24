/**
 * Bundesland zu einer PLZ aus der amtlichen RTR-Tabelle (abgeleitet von
 * `data/plz-at.json` durch src/scripts/build-plz-db.ts). Klein genug für
 * den Client. PLZ-Mittelpunkte gibt es nur noch über die Gemeinde-
 * Stammdatei (src/lib/location/gemeinde-index.ts, plzCentroid).
 */
import PLZ_BUNDESLAND from '../../../data/plz-bundesland.json';

/**
 * Bundesland zu einer PLZ: zuerst die amtliche RTR-Tabelle
 * (`data/plz-bundesland.json`, 2.234 PLZ), erst für unbekannte PLZ die
 * Präfixregel. Die Präfixregel allein lag für 99 PLZ falsch: Osttirol
 * (99xx ist Tirol, nicht Kärnten), Innviertel (51xx–53xx ist
 * Oberösterreich, nicht Salzburg), St. Valentin/Ennsdorf (43xx/44xx ist
 * Niederösterreich), Kittsee/Nickelsdorf (24xx ist Burgenland),
 * Jennersdorf (838x ist Burgenland). Mit dem falschen Label verwarf der
 * Freigabevertrag richtige Koordinaten (Prod 2026-09-14, 1.624 Events).
 */
export function getBundeslandFromPLZ(plz: string): string | null {
  if (!plz) return null;
  const official = (PLZ_BUNDESLAND as Record<string, string>)[plz.trim().slice(0, 4)];
  if (official) return official;
  const first = parseInt(plz.charAt(0));
  const firstTwo = parseInt(plz.slice(0, 2));

  if (first === 1) return 'wien';
  if (first === 2 || first === 3) return 'niederoesterreich';
  if (first === 4) return 'oberoesterreich';
  if (firstTwo >= 50 && firstTwo <= 57) return 'salzburg';
  if (firstTwo >= 60 && firstTwo <= 66) return 'tirol';
  if (firstTwo >= 67 && firstTwo <= 69) return 'vorarlberg';
  if (firstTwo >= 70 && firstTwo <= 78) return 'burgenland';
  if (first === 8) return 'steiermark';
  if (first === 9) return 'kaernten';

  return null;
}
