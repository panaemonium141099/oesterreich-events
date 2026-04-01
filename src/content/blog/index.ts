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
