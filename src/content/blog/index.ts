import type { FestivalPost } from './types';
// fn-21: Rubrik "Übernachten" — kuratierte Unterkunfts-Artikel
import { post as besondereUnterkuenfteBurgenland } from './posts/besondere-unterkuenfte-burgenland';
import { post as aussergewoehnlichUebernachtenOesterreich } from './posts/aussergewoehnlich-uebernachten-oesterreich';
import { post as novaRock } from './posts/nova-rock-2026';
import { post as donauinselfest } from './posts/donauinselfest-2026';
import { post as frequency } from './posts/frequency-festival-2026';
import { post as wienChristkindlmarkt } from './posts/wien-christkindlmarkt';
import { post as wienerSilvesterpfad } from './posts/wiener-silvesterpfad';
import { post as wienerOpernball } from './posts/wiener-opernball';
import { post as wienerNeujahrskonzert } from './posts/wiener-neujahrskonzert';
import { post as wienerFestwochen } from './posts/wiener-festwochen';
import { post as viennaCityMarathon } from './posts/vienna-city-marathon';
import { post as wienerRegenbogenparade } from './posts/wiener-regenbogenparade';
import { post as kaiserWiesn } from './posts/kaiser-wiesn';
import { post as wienerGenussfestival } from './posts/wiener-genussfestival';
import { post as viennale } from './posts/viennale';
import { post as salzburgerFestspiele } from './posts/salzburger-festspiele';
import { post as salzburgerChristkindlmarkt } from './posts/salzburger-christkindlmarkt';
import { post as salzburgJazzAndTheCity } from './posts/salzburg-jazz-and-the-city';
import { post as salzburgerDult } from './posts/salzburger-dult';
import { post as hahnenkammRennenKitzbuehel } from './posts/hahnenkamm-rennen-kitzbuehel';
import { post as innsbruckFestwochenAlteMusik } from './posts/innsbruck-festwochen-alte-musik';
import { post as innsbruckChristkindlmarkt } from './posts/innsbruck-christkindlmarkt';
import { post as tirolerVolksschauspielesTelfs } from './posts/tiroler-volksschauspiele-telfs';
import { post as snowbombingMayrhofen } from './posts/snowbombing-mayrhofen';
import { post as europaeischesForumAlpbach } from './posts/europaeisches-forum-alpbach';
import { post as linzPflasterspektakel } from './posts/linz-pflasterspektakel';
import { post as linzerKlangwolke } from './posts/linzer-klangwolke';
import { post as linzerChristkindlmarkt } from './posts/linzer-christkindlmarkt';
import { post as arsElectronicaFestival } from './posts/ars-electronica-festival';
import { post as steyrStadtfest } from './posts/steyr-stadtfest';
import { post as bregenzFestspiele } from './posts/bregenz-festspiele';
import { post as bregenzerFruehling } from './posts/bregenzer-fruehling';
import { post as montafonerSommertage } from './posts/montafoner-sommertage';
import { post as feldkirchFestival } from './posts/feldkirch-festival';
import { post as lustenauMartinimarkt } from './posts/lustenauer-martinimarkt';
import { post as styriarteGraz } from './posts/styriarte-graz';
import { post as grazerAufsteirern } from './posts/grazer-aufsteirern';
import { post as grazerChristkindlmarkt } from './posts/grazer-christkindlmarkt';
import { post as klagenfurterStadtfest } from './posts/klagenfurter-stadtfest';
import { post as ironmanAustriaKlagenfurt } from './posts/ironman-austria-klagenfurt';
import { post as villacherFasching } from './posts/villacher-fasching';
import { post as woertherseeBeachvolleyball } from './posts/woerthersee-beachvolleyball';
import { post as carinthianSummerOssiach } from './posts/carinthian-summer-ossiach';
import { post as murauStadtfest } from './posts/murau-stadtfest';
import { post as woertherseeRegatta } from './posts/woerthersee-regatta';
import { post as grafeneggFestival } from './posts/grafenegg-festival';
import { post as leharFestivalBadIschl } from './posts/lehar-festival-bad-ischl';
import { post as esterhazKonzerte } from './posts/esterhazy-konzerte';
import { post as pannoniaFields } from './posts/pannonia-fields';
import { post as seefestspieleMoerbisch } from './posts/seefestspiele-moerbisch';
import { post as wiesenFest } from './posts/wiesen-fest';
import { post as lichterfestMelk } from './posts/lichterfest-melk';
import { post as retzWeinlesefest } from './posts/retz-weinlesefest';
import { post as linzMarathon } from './posts/linz-marathon';
import { post as electricLove } from './posts/electric-love-festival-2026';
import { post as poolbarFestival } from './posts/poolbar-festival-2026';
import { post as impulsTanz } from './posts/impulstanz-2026';
import { post as narzissenfest } from './posts/narzissenfest-2026';
import { post as sommernachtskonzert } from './posts/sommernachtskonzert-schoenbrunn-2026';
import { post as musikfestivalSteyr } from './posts/musikfestival-steyr-2026';
import { post as glattUndVerkehrt } from './posts/glatt-und-verkehrt-2026';
import { post as jazzfestWien } from './posts/jazzfest-wien-2026';
import { post as schlosspieleKobersdorf } from './posts/schlossspiele-kobersdorf-2026';
import { post as tirolerFestspiele } from './posts/tiroler-festspiele-erl-2026';
import { post as festDerFreude } from './posts/fest-der-freude-2026';
import { post as spitzerMarillenkirtag } from './posts/spitzer-marillenkirtag-2026';
// Autowriter-Posts (fn-19) — Marker NICHT entfernen, das Script fuegt hier ein:
import { post as theUmbilicalBrothersSpeedmouse25thAnniversaryTour2026 } from './posts/the-umbilical-brothers-speedmouse-25th-anniversary-tour-2026';
import { post as finkEuropeTour20262026 } from './posts/fink-europe-tour-2026-2026';
import { post as sophiaOderDasEndeDerHumanisten2026 } from './posts/sophia-oder-das-ende-der-humanisten-2026';
import { post as angeloKelly2026 } from './posts/angelo-kelly-2026';
import { post as circusRoncalli2026 } from './posts/circus-roncalli-2026';
import { post as lumpazivagabundusNestroyIm34Takt2026 } from './posts/lumpazivagabundus-nestroy-im-3-4-takt-2026';
import { post as soundingIslandsOliverMallyPeterSchneider2026 } from './posts/sounding-islands-oliver-mally-peter-schneider-2026';
import { post as altstadtRundgangDeutsch2026 } from './posts/altstadt-rundgang-deutsch-2026';
import { post as imperialGalaConcert2026 } from './posts/imperial-gala-concert-2026';
import { post as disneySArielleDieMeerjungfrau2026 } from './posts/disney-s-arielle-die-meerjungfrau-2026';
import { post as sonosCliq2026 } from './posts/sonos-cliq-2026';
// AUTOWRITER-IMPORTS-END

export type { FestivalPost, GalleryImage, FestivalKeyFacts, LineupAct } from './types';

/** All blog posts sorted by publishDate descending (newest first). */
export const ALL_POSTS: FestivalPost[] = [
  besondereUnterkuenfteBurgenland,
  aussergewoehnlichUebernachtenOesterreich,
  novaRock,
  donauinselfest,
  frequency,
  wienChristkindlmarkt,
  wienerSilvesterpfad,
  wienerOpernball,
  wienerNeujahrskonzert,
  wienerFestwochen,
  viennaCityMarathon,
  wienerRegenbogenparade,
  kaiserWiesn,
  wienerGenussfestival,
  viennale,
  salzburgerFestspiele,
  salzburgerChristkindlmarkt,
  salzburgJazzAndTheCity,
  salzburgerDult,
  hahnenkammRennenKitzbuehel,
  innsbruckFestwochenAlteMusik,
  innsbruckChristkindlmarkt,
  tirolerVolksschauspielesTelfs,
  snowbombingMayrhofen,
  europaeischesForumAlpbach,
  linzPflasterspektakel,
  linzerKlangwolke,
  linzerChristkindlmarkt,
  arsElectronicaFestival,
  steyrStadtfest,
  bregenzFestspiele,
  bregenzerFruehling,
  montafonerSommertage,
  feldkirchFestival,
  lustenauMartinimarkt,
  styriarteGraz,
  grazerAufsteirern,
  grazerChristkindlmarkt,
  klagenfurterStadtfest,
  ironmanAustriaKlagenfurt,
  villacherFasching,
  woertherseeBeachvolleyball,
  carinthianSummerOssiach,
  murauStadtfest,
  woertherseeRegatta,
  grafeneggFestival,
  leharFestivalBadIschl,
  esterhazKonzerte,
  pannoniaFields,
  seefestspieleMoerbisch,
  wiesenFest,
  lichterfestMelk,
  retzWeinlesefest,
  linzMarathon,
  electricLove,
  poolbarFestival,
  impulsTanz,
  narzissenfest,
  sommernachtskonzert,
  musikfestivalSteyr,
  glattUndVerkehrt,
  jazzfestWien,
  schlosspieleKobersdorf,
  tirolerFestspiele,
  festDerFreude,
  spitzerMarillenkirtag,
  theUmbilicalBrothersSpeedmouse25thAnniversaryTour2026,
  finkEuropeTour20262026,
  sophiaOderDasEndeDerHumanisten2026,
  angeloKelly2026,
  circusRoncalli2026,
  lumpazivagabundusNestroyIm34Takt2026,
  soundingIslandsOliverMallyPeterSchneider2026,
  altstadtRundgangDeutsch2026,
  imperialGalaConcert2026,
  disneySArielleDieMeerjungfrau2026,
  sonosCliq2026,
  // AUTOWRITER-POSTS-END
].sort(
  (a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
);

export function getPostBySlug(slug: string): FestivalPost | undefined {
  return ALL_POSTS.find(p => p.slug === slug);
}

export function getPostsByCategory(category: string): FestivalPost[] {
  return ALL_POSTS.filter(p => p.category === category);
}

/** @deprecated Use ALL_POSTS instead */
export const FESTIVAL_POSTS = ALL_POSTS;

/** @deprecated Use getPostBySlug instead */
export function getFestivalBySlug(slug: string): FestivalPost | undefined {
  return getPostBySlug(slug);
}

/** @deprecated Use ALL_POSTS.map(p => p.slug) instead */
export function getAllFestivalSlugs(): string[] {
  return ALL_POSTS.map(p => p.slug);
}
