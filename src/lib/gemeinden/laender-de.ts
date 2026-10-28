/**
 * Die 16 deutschen Länder: amtlicher Landesschlüssel (erste zwei Stellen von
 * AGS/ARS) und kanonische ID. Ohne Datenabhängigkeit, auch im Client nutzbar.
 * Die IDs kollidieren mit keiner österreichischen Bundesland-ID.
 */
export interface DeLand {
  /** Landesschlüssel laut Destatis, zweistellig. */
  code: string;
  id: string;
  name: string;
}

export const DE_LAENDER: ReadonlyArray<DeLand> = [
  { code: '01', id: 'schleswig-holstein', name: 'Schleswig-Holstein' },
  { code: '02', id: 'hamburg', name: 'Hamburg' },
  { code: '03', id: 'niedersachsen', name: 'Niedersachsen' },
  { code: '04', id: 'bremen', name: 'Bremen' },
  { code: '05', id: 'nordrhein-westfalen', name: 'Nordrhein-Westfalen' },
  { code: '06', id: 'hessen', name: 'Hessen' },
  { code: '07', id: 'rheinland-pfalz', name: 'Rheinland-Pfalz' },
  { code: '08', id: 'baden-wuerttemberg', name: 'Baden-Württemberg' },
  { code: '09', id: 'bayern', name: 'Bayern' },
  { code: '10', id: 'saarland', name: 'Saarland' },
  { code: '11', id: 'berlin', name: 'Berlin' },
  { code: '12', id: 'brandenburg', name: 'Brandenburg' },
  { code: '13', id: 'mecklenburg-vorpommern', name: 'Mecklenburg-Vorpommern' },
  { code: '14', id: 'sachsen', name: 'Sachsen' },
  { code: '15', id: 'sachsen-anhalt', name: 'Sachsen-Anhalt' },
  { code: '16', id: 'thueringen', name: 'Thüringen' },
];

const BY_ID = new Map(DE_LAENDER.map(l => [l.id, l]));
const BY_CODE = new Map(DE_LAENDER.map(l => [l.code, l]));

export function deLandById(id: string): DeLand | null {
  return BY_ID.get(id) ?? null;
}

/** Land zum Gemeindeschlüssel (AGS/ARS) über die ersten zwei Stellen. */
export function deLandByKey(key: string): DeLand | null {
  return BY_CODE.get(key.slice(0, 2)) ?? null;
}

const SHORT_CODES: Record<string, string> = {
  bw: 'baden-wuerttemberg', by: 'bayern', be: 'berlin', bb: 'brandenburg', hb: 'bremen', hh: 'hamburg',
  he: 'hessen', mv: 'mecklenburg-vorpommern', ni: 'niedersachsen', nw: 'nordrhein-westfalen', nrw: 'nordrhein-westfalen',
  rp: 'rheinland-pfalz', rlp: 'rheinland-pfalz', sl: 'saarland', sn: 'sachsen', st: 'sachsen-anhalt',
  sh: 'schleswig-holstein', th: 'thueringen',
};

function compact(s: string): string {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

const BY_COMPACT = new Map(DE_LAENDER.map(l => [compact(l.name), l.id]));

/**
 * Land-ID zu einer Quellangabe („Bayern", „Nordrhein-Westfalen", „NRW",
 * „Baden-Wuerttemberg", „bayern"), sonst null. Nur für deutsche Events
 * verwenden: „ST" ist hier Sachsen-Anhalt, nicht die Steiermark.
 */
export function deLandToId(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const lc = raw.trim().toLowerCase();
  if (SHORT_CODES[lc]) return SHORT_CODES[lc];
  return BY_COMPACT.get(compact(raw)) ?? null;
}
