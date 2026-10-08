import type { FestivalPost } from './types';
// fn-24: Saison-Seiten (SAISON_KALENDER, frist-getrieben)
import { post as langeNachtDerMuseen } from './posts/lange-nacht-der-museen';
import { post as halloweenOesterreich } from './posts/halloween-oesterreich';
import { post as nationalfeiertagOesterreich } from './posts/nationalfeiertag-oesterreich';
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
import { post as uebernachtenGrazKonzertbesucher } from './posts/uebernachten-graz-konzertbesucher';
import { post as dieMusikVonHarryPotterDasKonzert2026 } from './posts/die-musik-von-harry-potter-das-konzert-2026';
import { post as peterCorneliusBandZeitlos2026 } from './posts/peter-cornelius-band-zeitlos-2026';
import { post as mariaTheresiaDasMusical2026 } from './posts/maria-theresia-das-musical-2026';
import { post as subwayToSally2026 } from './posts/subway-to-sally-2026';
import { post as klassischeKonzerteHausDerMusik2026 } from './posts/klassische-konzerte-haus-der-musik-2026';
import { post as vivaldiVierJahreszeitenKonzert2026 } from './posts/vivaldi-vier-jahreszeiten-konzert-2026';
import { post as wienerMozartKonzertMusikverein2026 } from './posts/wiener-mozart-konzert-musikverein-2026';
import { post as eltonJohnBillyJoelTribute2026 } from './posts/elton-john-billy-joel-tribute-2026';
import { post as blackSeaDahu2026 } from './posts/black-sea-dahu-2026';
import { post as mcYankooLive2026 } from './posts/mc-yankoo-live-2026';
import { post as uebernachtenWienGuenstig } from './posts/uebernachten-wien-guenstig';
import { post as theDarkTenor2026 } from './posts/the-dark-tenor-2026';
import { post as freddieMercuryOperaShow2026 } from './posts/freddie-mercury-opera-show-2026';
import { post as scienceBustersForKids2026 } from './posts/science-busters-for-kids-2026';
import { post as mariaUndDieFledermaus2026 } from './posts/maria-und-die-fledermaus-2026';
import { post as konzerteInDerMinoritenkircheGrandeMusica2026 } from './posts/konzerte-in-der-minoritenkirche-grande-musica-2026';
import { post as viennaDeathfest20262026 } from './posts/vienna-deathfest-2026-2026';
import { post as rockPubRevivalFestivalVol12026 } from './posts/rock-pub-revival-festival-vol-1-2026';
import { post as zipfZapfFest2026 } from './posts/zipf-zapf-fest-2026';
import { post as marinAlsopHorizonteBenefizkonzert2026 } from './posts/marin-alsop-horizonte-benefizkonzert-2026';
import { post as pavelShalmanBokiRadenkovicElectricRoseKlezmoreFestiva2026 } from './posts/pavel-shalman-boki-radenkovic-electric-rose-klezmore-festiva-2026';
import { post as tomWalekDerOe3MicromannLive2026 } from './posts/tom-walek-der-oe3-micromann-live-2026';
import { post as konzerteInDerPeterskircheWien2026 } from './posts/konzerte-in-der-peterskirche-wien-2026';
import { post as designDistrictLivingLifestyleMesse2026 } from './posts/design-district-living-lifestyle-messe-2026';
import { post as againstTheCurrent2026 } from './posts/against-the-current-2026';
import { post as neilDiamondMoments2026 } from './posts/neil-diamond-moments-2026';
import { post as derDienerZweierHerren2026 } from './posts/der-diener-zweier-herren-2026';
import { post as steamingSatellites2026 } from './posts/steaming-satellites-2026';
import { post as uebernachtenSalzburgFestspielzeit } from './posts/uebernachten-salzburg-festspielzeit';
import { post as kreiskyAdieuUnsterblichkeitRosentalRozFestival2026 } from './posts/kreisky-adieu-unsterblichkeit-rosental-roz-festival-2026';
import { post as robertStadloberRosentalRozFestival2026 } from './posts/robert-stadlober-rosental-roz-festival-2026';
import { post as adventkonzerteInDerKapuzinerkirche2026 } from './posts/adventkonzerte-in-der-kapuzinerkirche-2026';
import { post as wir4DieJubilaeumstour20262026 } from './posts/wir4-die-jubilaeumstour-2026-2026';
import { post as lansdowneWishYouWellTourPart22026 } from './posts/lansdowne-wish-you-well-tour-part-2-2026';
import { post as melanieBaker2026 } from './posts/melanie-baker-2026';
import { post as symphonieorchesterVorarlbergKonzert3DiakunSchumannDvor2026 } from './posts/symphonieorchester-vorarlberg-konzert-3-diakun-schumann-dvor-2026';
import { post as averageKayo2026 } from './posts/average-kayo-2026';
import { post as oskarHaagLostCauseTour20262026 } from './posts/oskar-haag-lost-cause-tour-2026-2026';
import { post as charityFestival2Tagesticket2026 } from './posts/charity-festival-2-tagesticket-2026';
import { post as gunklAproposUebrigens2026 } from './posts/gunkl-apropos-uebrigens-2026';
import { post as post4GaengeGourmetDinner2026 } from './posts/4-gaenge-gourmet-dinner-2026';
import { post as orgelkonzertBachMozartChopinUA2026 } from './posts/orgelkonzert-bach-mozart-chopin-u-a-2026';
import { post as panEnglishComedyTour20262026 } from './posts/pan-english-comedy-tour-2026-2026';
import { post as amadeusConcertsVienna2026 } from './posts/amadeus-concerts-vienna-2026';
import { post as starsOfBoogieWoogieMitDanielEcklbauer2026 } from './posts/stars-of-boogie-woogie-mit-daniel-ecklbauer-2026';
import { post as uebernachtenNeusiedlerSeeFestivalsommer } from './posts/uebernachten-neusiedler-see-festivalsommer';
import { post as oe3GasteinSounds2026PizzeraJausFolkshilfeKarl2026 } from './posts/oe3-gastein-sounds-2026-pizzera-jaus-folkshilfe-karl-2026';
import { post as lilianKlebowGernotHaasOPannenbaum2026 } from './posts/lilian-klebow-gernot-haas-o-pannenbaum-2026';
import { post as eggBigBandWeihnachtskonzert2026 } from './posts/egg-big-band-weihnachtskonzert-2026';
import { post as oe3GasteinSounds2026PaulKalkbrenner2026 } from './posts/oe3-gastein-sounds-2026-paul-kalkbrenner-2026';
import { post as schwarzautalerWiesNOktoberfest20262026 } from './posts/schwarzautaler-wies-n-oktoberfest-2026-2026';
import { post as autumnLeaves2026Festivalpass2026 } from './posts/autumn-leaves-2026-festivalpass-2026';
import { post as letSDanceDieLiveTour20262026 } from './posts/let-s-dance-die-live-tour-2026-2026';
import { post as weihnachtskonzertImKerzenscheinIvaHoelzlNikolovaDaniel2026 } from './posts/weihnachtskonzert-im-kerzenschein-iva-hoelzl-nikolova-daniel-2026';
import { post as benefizkonzertFuerOswaldKiechle2026 } from './posts/benefizkonzert-fuer-oswald-kiechle-2026';
import { post as hellbrunnerSchlosskonzerte2026 } from './posts/hellbrunner-schlosskonzerte-2026';
import { post as gregorMeyleBandUnpluggedDasWohnzimmerkonzert2026 } from './posts/gregor-meyle-band-unplugged-das-wohnzimmerkonzert-2026';
import { post as nuitDesLumieresDinnerkonzertWien2026 } from './posts/nuit-des-lumieres-dinnerkonzert-wien-2026';
import { post as diePaldauerWeihnachtskonzert2026 } from './posts/die-paldauer-weihnachtskonzert-2026';
import { post as derSuessesteWahnsinn2026 } from './posts/der-suesseste-wahnsinn-2026';
import { post as uebernachtenInnsbruckBerge } from './posts/uebernachten-innsbruck-berge';
import { post as sowiFestLessStudyingMoreDancing2026 } from './posts/sowi-fest-less-studying-more-dancing-2026';
import { post as houseOfBanksyWienAnUnauthorizedExhibition2026 } from './posts/house-of-banksy-wien-an-unauthorized-exhibition-2026';
import { post as konzerteInDerMinoritenkircheAdventskonzertInDerMinori2026 } from './posts/konzerte-in-der-minoritenkirche-adventskonzert-in-der-minori-2026';
import { post as poxruckerSistersHorizontSupportRobaRosentalRozFestiva2026 } from './posts/poxrucker-sisters-horizont-support-roba-rosental-roz-festiva-2026';
import { post as bolschoiDonKosakenAdventkonzert2026 } from './posts/bolschoi-don-kosaken-adventkonzert-2026';
import { post as inaRegenRevolutionDerLiebesliederTour2026 } from './posts/ina-regen-revolution-der-liebeslieder-tour-2026';
import { post as eltonJohnTributeDinnerKonzert2026 } from './posts/elton-john-tribute-dinner-konzert-2026';
import { post as mcBomberDieSerioeseTour2026 } from './posts/mc-bomber-die-serioese-tour-2026';
// AUTOWRITER-IMPORTS-END

export type { FestivalPost, GalleryImage, FestivalKeyFacts, LineupAct } from './types';

/** All blog posts sorted by publishDate descending (newest first). */import { post as herbstfesteErntedankOesterreich } from './posts/herbstfeste-erntedank-oesterreich';
import { post as christkindlmaerkteOesterreich } from './posts/christkindlmaerkte-oesterreich';
import { post as krampuslaufPerchtenlaufOesterreich } from './posts/krampuslauf-perchtenlauf-oesterreich';

export const ALL_POSTS: FestivalPost[] = [
  krampuslaufPerchtenlaufOesterreich,
  christkindlmaerkteOesterreich,
  herbstfesteErntedankOesterreich,
  langeNachtDerMuseen,
  halloweenOesterreich,
  nationalfeiertagOesterreich,
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
  uebernachtenGrazKonzertbesucher,
  dieMusikVonHarryPotterDasKonzert2026,
  peterCorneliusBandZeitlos2026,
  mariaTheresiaDasMusical2026,
  subwayToSally2026,
  klassischeKonzerteHausDerMusik2026,
  vivaldiVierJahreszeitenKonzert2026,
  wienerMozartKonzertMusikverein2026,
  eltonJohnBillyJoelTribute2026,
  blackSeaDahu2026,
  mcYankooLive2026,
  uebernachtenWienGuenstig,
  theDarkTenor2026,
  freddieMercuryOperaShow2026,
  scienceBustersForKids2026,
  mariaUndDieFledermaus2026,
  konzerteInDerMinoritenkircheGrandeMusica2026,
  viennaDeathfest20262026,
  rockPubRevivalFestivalVol12026,
  zipfZapfFest2026,
  marinAlsopHorizonteBenefizkonzert2026,
  pavelShalmanBokiRadenkovicElectricRoseKlezmoreFestiva2026,
  tomWalekDerOe3MicromannLive2026,
  konzerteInDerPeterskircheWien2026,
  designDistrictLivingLifestyleMesse2026,
  againstTheCurrent2026,
  neilDiamondMoments2026,
  derDienerZweierHerren2026,
  steamingSatellites2026,
  uebernachtenSalzburgFestspielzeit,
  kreiskyAdieuUnsterblichkeitRosentalRozFestival2026,
  robertStadloberRosentalRozFestival2026,
  adventkonzerteInDerKapuzinerkirche2026,
  wir4DieJubilaeumstour20262026,
  lansdowneWishYouWellTourPart22026,
  melanieBaker2026,
  symphonieorchesterVorarlbergKonzert3DiakunSchumannDvor2026,
  averageKayo2026,
  oskarHaagLostCauseTour20262026,
  charityFestival2Tagesticket2026,
  gunklAproposUebrigens2026,
  post4GaengeGourmetDinner2026,
  orgelkonzertBachMozartChopinUA2026,
  panEnglishComedyTour20262026,
  amadeusConcertsVienna2026,
  starsOfBoogieWoogieMitDanielEcklbauer2026,
  uebernachtenNeusiedlerSeeFestivalsommer,
  oe3GasteinSounds2026PizzeraJausFolkshilfeKarl2026,
  lilianKlebowGernotHaasOPannenbaum2026,
  eggBigBandWeihnachtskonzert2026,
  oe3GasteinSounds2026PaulKalkbrenner2026,
  schwarzautalerWiesNOktoberfest20262026,
  autumnLeaves2026Festivalpass2026,
  letSDanceDieLiveTour20262026,
  weihnachtskonzertImKerzenscheinIvaHoelzlNikolovaDaniel2026,
  benefizkonzertFuerOswaldKiechle2026,
  hellbrunnerSchlosskonzerte2026,
  gregorMeyleBandUnpluggedDasWohnzimmerkonzert2026,
  nuitDesLumieresDinnerkonzertWien2026,
  diePaldauerWeihnachtskonzert2026,
  derSuessesteWahnsinn2026,
  uebernachtenInnsbruckBerge,
  sowiFestLessStudyingMoreDancing2026,
  houseOfBanksyWienAnUnauthorizedExhibition2026,
  konzerteInDerMinoritenkircheAdventskonzertInDerMinori2026,
  poxruckerSistersHorizontSupportRobaRosentalRozFestiva2026,
  bolschoiDonKosakenAdventkonzert2026,
  inaRegenRevolutionDerLiebesliederTour2026,
  eltonJohnTributeDinnerKonzert2026,
  mcBomberDieSerioeseTour2026,
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
