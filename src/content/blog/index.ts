import type { FestivalPost } from './types';
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

export type { FestivalPost, GalleryImage, FestivalKeyFacts, LineupAct } from './types';

/** All blog posts sorted by publishDate descending (newest first). */
export const ALL_POSTS: FestivalPost[] = [
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
