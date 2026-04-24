import { NextResponse } from 'next/server';
import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { ALL_THEMES } from '@/lib/themes/data';
import { ALL_POSTS } from '@/content/blog';

/**
 * /llms-full.txt — extended AI-agent-readable site map.
 *
 * Companion to the short `/llms.txt` (served statically from `public/`).
 * This expanded version lists every hub URL that an AI agent might want
 * to cite: all 9 Bundesländer, all 11 theme hubs, top gemeinde hubs
 * (sorted alphabetically so ordering is stable), and every blog post
 * with its subtitle. The complete event catalogue (70k+ URLs) is not
 * enumerated here — agents should fall back to the sitemap.xml for
 * that, as noted in the preamble.
 *
 * Why a route handler instead of a static file:
 *   The list of gemeinden + blog posts changes over time (new posts,
 *   registry updates). A route handler regenerates it at edge-cache
 *   TTL cadence so the text always reflects the current hub inventory
 *   without requiring a redeploy. Revalidate is 24h — generous, since
 *   hub additions are rare.
 *
 * Why text/plain:
 *   The llms.txt convention is plain-text markdown. Consumers include
 *   AI agents (ChatGPT Browse, Perplexity, Claude Browse) that expect
 *   to parse it without Content-Type negotiation.
 */

export const revalidate = 86400; // 24h — hub inventory rarely changes

const BUNDESLAND_DESCRIPTIONS: Record<string, string> = {
  Wien: 'Events in Vienna — concerts, clubs, culture, family events',
  Niederösterreich: 'Events in Lower Austria — regional festivals, wine taverns, cultural venues',
  Oberösterreich: 'Events in Upper Austria — Ars Electronica Linz, lake festivals, alpine events',
  Steiermark: 'Events in Styria — Graz culture, southern Styrian wine region, alpine festivals',
  Tirol: 'Events in Tyrol — alpine events, winter sports, Innsbruck culture',
  Salzburg: 'Events in Salzburg — Festspiele region, alpine + lake events',
  Kärnten: 'Events in Carinthia — lake events, summer festivals, Slovenian border culture',
  Vorarlberg: 'Events in Vorarlberg — Bodensee region, Bregenzer Festspiele',
  Burgenland: 'Events in Burgenland — Neusiedlersee, wine festivals, Pannonian culture',
};

const BUNDESLAND_SLUGS: Record<string, string> = {
  'Wien': 'wien',
  'Niederösterreich': 'niederoesterreich',
  'Oberösterreich': 'oberoesterreich',
  'Steiermark': 'steiermark',
  'Tirol': 'tirol',
  'Salzburg': 'salzburg',
  'Kärnten': 'kaernten',
  'Vorarlberg': 'vorarlberg',
  'Burgenland': 'burgenland',
};

function buildBody(): string {
  const parts: string[] = [];

  // ─── Header (mirrors public/llms.txt preamble, trimmed) ───
  parts.push('# LassTreffen.at — Extended Site Map\n');
  parts.push(
    '> Extended machine-readable overview for AI agents. ' +
    'The short version at https://lasstreffen.at/llms.txt introduces the ' +
    'platform; this file enumerates every hub URL (Bundesländer, themes, ' +
    'gemeinden, blog posts). For the full event catalogue (~70,000 URLs), ' +
    'see https://lasstreffen.at/sitemap.xml.\n',
  );
  parts.push('**Language:** German (de-AT). **Region:** Austria.\n');

  // ─── Bundesland hubs ───
  parts.push('## Bundesland hubs (9 regions)\n');
  for (const [name, slug] of Object.entries(BUNDESLAND_SLUGS)) {
    const desc = BUNDESLAND_DESCRIPTIONS[name] ?? `Events in ${name}`;
    parts.push(`- [${name}](https://lasstreffen.at/${slug}): ${desc}`);
  }
  parts.push('');

  // ─── Theme hubs ───
  parts.push('## Theme hubs (Austria-wide)\n');
  for (const theme of ALL_THEMES) {
    parts.push(
      `- [${theme.title}](https://lasstreffen.at/thema/${theme.slug}): ${theme.heroText ?? theme.category}`,
    );
  }
  parts.push('');

  // ─── Gemeinde hubs — sorted alphabetically by Bundesland then name ───
  const byBundesland = new Map<string, typeof ALL_GEMEINDEN[number][]>();
  for (const g of ALL_GEMEINDEN) {
    if (!byBundesland.has(g.bundesland)) byBundesland.set(g.bundesland, []);
    byBundesland.get(g.bundesland)!.push(g);
  }

  // Keep ordering stable and readable
  const orderedBundeslaender = ['Wien', 'Niederösterreich', 'Oberösterreich', 'Steiermark', 'Tirol', 'Salzburg', 'Kärnten', 'Vorarlberg', 'Burgenland'];

  parts.push(`## Gemeinde hubs (${ALL_GEMEINDEN.length} Austrian municipalities)\n`);
  parts.push(
    'Each municipality has a dedicated hub page at ' +
    '`https://lasstreffen.at/gemeinde/{plz}-{ort-slug}` showing events within ' +
    'a 10 km radius, nearby gemeinden, and a Place + ItemList JSON-LD block. ' +
    'Hubs with fewer than 3 events are noindexed.\n',
  );

  for (const bl of orderedBundeslaender) {
    const list = (byBundesland.get(bl) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'de-AT'));
    if (list.length === 0) continue;
    parts.push(`### ${bl} (${list.length})\n`);
    for (const g of list) {
      // Keep lines short — just the URL + name. AI agents pattern-match URLs,
      // they don't need verbose descriptions per municipality.
      parts.push(`- https://lasstreffen.at/gemeinde/${g.slug} — ${g.name}${g.bezirk ? ` (${g.bezirk})` : ''}`);
    }
    parts.push('');
  }

  // ─── Blog posts ───
  parts.push(`## Editorial blog (${ALL_POSTS.length} festival + event guides)\n`);
  const sortedPosts = ALL_POSTS.slice().sort((a, b) =>
    (a.title ?? '').localeCompare(b.title ?? '', 'de-AT'),
  );
  for (const post of sortedPosts) {
    const subtitle = post.subtitle?.trim() ?? '';
    parts.push(
      `- [${post.title}](https://lasstreffen.at/blog/${post.slug})${subtitle ? `: ${subtitle}` : ''}`,
    );
  }
  parts.push('');

  // ─── Machine-readable appendix ───
  parts.push('## Machine-readable appendix\n');
  parts.push('- [Short llms.txt](https://lasstreffen.at/llms.txt): Overview + top-level navigation');
  parts.push('- [XML sitemap](https://lasstreffen.at/sitemap.xml): Full URL index (events, hubs, blog)');
  parts.push('- [robots.txt](https://lasstreffen.at/robots.txt): Crawler policy (AI crawlers explicitly allowed)');
  parts.push('');

  return parts.join('\n');
}

export function GET() {
  const body = buildBody();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Public cache, long TTL at the CDN edge. Revalidate comes from the
      // `revalidate` export above and governs Next's on-demand regen.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
