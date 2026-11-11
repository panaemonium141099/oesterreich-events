/**
 * Beschriftung der Spielart auf Künstlerkarten (Plakatwand): der häufigste
 * Genre-Tag der Termine (Taxonomie in enrichment-taxonomy.ts), lesbar in de
 * und en. Unbekannte Tags erscheinen mit großem Anfangsbuchstaben.
 */

import type { ArtistKind } from './directory';

const GENRE: Record<string, [de: string, en: string]> = {
  kabarett: ['Kabarett', 'Cabaret'],
  comedy: ['Comedy', 'Comedy'],
  'stand-up': ['Stand-up', 'Stand-up'],
  improtheater: ['Improtheater', 'Improv'],
  theater: ['Theater', 'Theatre'],
  musical: ['Musical', 'Musical'],
  oper: ['Oper', 'Opera'],
  operette: ['Operette', 'Operetta'],
  ballett: ['Ballett', 'Ballet'],
  kindertheater: ['Kindertheater', 'Children’s theatre'],
  lesung: ['Lesung', 'Reading'],
  'performance-art': ['Performance', 'Performance'],
  zirkus: ['Zirkus', 'Circus'],
  klassik: ['Klassik', 'Classical'],
  kammermusik: ['Kammermusik', 'Chamber music'],
  chor: ['Chor', 'Choir'],
  orgel: ['Orgel', 'Organ'],
  jazz: ['Jazz', 'Jazz'],
  bigband: ['Big Band', 'Big band'],
  swing: ['Swing', 'Swing'],
  pop: ['Pop', 'Pop'],
  rock: ['Rock', 'Rock'],
  indie: ['Indie', 'Indie'],
  alternative: ['Alternative', 'Alternative'],
  metal: ['Metal', 'Metal'],
  punk: ['Punk', 'Punk'],
  'hip-hop': ['Hip-Hop', 'Hip-hop'],
  rap: ['Rap', 'Rap'],
  'r-n-b': ['R&B', 'R&B'],
  soul: ['Soul', 'Soul'],
  funk: ['Funk', 'Funk'],
  disco: ['Disco', 'Disco'],
  schlager: ['Schlager', 'Schlager'],
  country: ['Country', 'Country'],
  folk: ['Folk', 'Folk'],
  'singer-songwriter': ['Singer-Songwriter', 'Singer-songwriter'],
  latin: ['Latin', 'Latin'],
  balkan: ['Balkan', 'Balkan'],
  weltmusik: ['Weltmusik', 'World music'],
  volksmusik: ['Volksmusik', 'Folk music'],
  blasmusik: ['Blasmusik', 'Brass band'],
  'austro-pop': ['Austropop', 'Austropop'],
  'dialekt-rap': ['Dialekt-Rap', 'Dialect rap'],
  electro: ['Electro', 'Electro'],
  techno: ['Techno', 'Techno'],
  house: ['House', 'House'],
  blues: ['Blues', 'Blues'],
};

const KIND: Record<ArtistKind, [de: string, en: string]> = {
  konzert: ['Konzert', 'Concert'],
  kabarett: ['Kabarett', 'Cabaret'],
  buehne: ['Bühne', 'Stage'],
  klassik: ['Klassik', 'Classical'],
  sonstiges: ['Live', 'Live'],
};

export function genreLabel(genre: string | null, kind: ArtistKind, locale: string): string {
  const i = locale === 'en' ? 1 : 0;
  if (genre && GENRE[genre]) return GENRE[genre][i];
  if (genre) return genre.charAt(0).toUpperCase() + genre.slice(1);
  return KIND[kind][i];
}

export function kindLabel(kind: ArtistKind, locale: string): string {
  return KIND[kind][locale === 'en' ? 1 : 0];
}
