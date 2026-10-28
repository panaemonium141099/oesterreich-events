/**
 * Feed-URL je Integration aus dem HTML der Kalenderseite (fn-29.4). Gelesen
 * wird nur, was die Seite selbst nennt (Attribut, Export-Link, Feed-Link im
 * Kopf); erfundene Standardpfade gibt es nur, wo der Hersteller einen festen
 * Pfad dokumentiert (The Events Calendar REST, Events Manager `/events.ics`).
 * Belege der Muster: docs/research/de-gemeinden/00-bundesweit.md und
 * 01-vollerhebung.md Abschnitt 3. REIN, kein I/O.
 */

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').replace(/&quot;/g, '"');
}

function abs(href: string, base: string): string | null {
  try {
    const u = new URL(decode(href.trim()), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Alle `<link rel="alternate">`-Feeds im Kopf mit ihrem Typ. */
function alternateFeeds(html: string, base: string): { type: string; href: string }[] {
  const out: { type: string; href: string }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']alternate["']/i.test(tag)) continue;
    const type = /type=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? '';
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || !/rss|atom|calendar/.test(type)) continue;
    const u = abs(href, base);
    if (u) out.push({ type, href: u });
  }
  return out;
}

function hrefs(html: string, base: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    if (!re.test(decode(m[1]))) continue;
    const u = abs(m[1], base);
    if (u) out.push(u);
  }
  return [...new Set(out)];
}

/** Ein eindeutiger Treffer, sonst null (kein Raten zwischen mehreren). */
function one(list: string[]): string | null {
  return list.length === 1 ? list[0] : null;
}

/**
 * Feed-URL der Integration aus der Kalenderseite `pageUrl` (bzw. der finalen
 * URL nach Weiterleitung) oder null, wenn die Seite keinen eindeutigen nennt.
 */
export function feedUrlFromPage(integration: string, html: string, pageUrl: string): string | null {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return null; } })();
  if (!origin) return null;
  switch (integration) {
    case 'ionas': {
      // TVM-Kalender: data-source="…/events.json?weekends=false&tagMode=ALL" (00-bundesweit, 08-hessen)
      const m = /data-source=["']([^"']*events\.json[^"']*)["']/i.exec(html);
      return m ? abs(m[1], pageUrl) : null;
    }
    case 'cross7': {
      const ids = [...new Set([...html.matchAll(/data-c7-page=["'](\d+)["']/gi)].map(m => m[1]))];
      return ids.length === 1 ? `https://api.cross-7.de/public/calendar/${ids[0]}/events` : null;
    }
    case 'nolis':
      // „vCalendar exportieren": /veranstaltungen/veranstaltungen.ical?…&selected_kommune=<ID>…
      return one(hrefs(html, pageUrl, /veranstaltungen\.ical\?/i));
    case 'komm1': {
      const direct = one(hrefs(html, pageUrl, /\/site\/[^/]+\/zmrss\/\d+\/rss\.xml/i));
      if (direct) return direct;
      // Pfad aus den Detail-Links der Liste: /site/<Mandant>/node/<nodeID>/zmdetail_…
      const nodes = new Set([...html.matchAll(/\/site\/([^/"']+)\/node\/(\d+)\/zmdetail_/gi)].map(m => `${m[1]}/${m[2]}`));
      if (nodes.size !== 1) return null;
      const [mandant, node] = [...nodes][0].split('/');
      return `${origin}/site/${mandant}/zmrss/${node}/rss.xml`;
    }
    case 'jevents':
      // Kopf führt RSS und Atom nebeneinander (soennebuell.de): RSS nehmen.
      return one(alternateFeeds(html, pageUrl).filter(f => /rss/.test(f.type) && /modlatest/i.test(f.href)).map(f => f.href))
        ?? one(hrefs(html, pageUrl, /task=modlatest\.rss.*type=rss/i));
    case 'icagenda':
      return one(alternateFeeds(html, pageUrl).filter(f => /rss/.test(f.type)).map(f => f.href));
    case 'dpcalendar':
      return one(hrefs(html, pageUrl, /task=ical\.download/i));
    case 'mec':
      return one(alternateFeeds(html, pageUrl).filter(f => /\/events\/feed\/?$|mec-events/i.test(f.href)).map(f => f.href))
        ?? one(hrefs(html, pageUrl, /\/events\/feed\/?$/i))
        // Die Kalenderseiten verlinken ihn selten; Standard des Plugins ist
        // /events/feed/ (Ettringen). Der Builder übernimmt ihn nur nach Abruf.
        ?? `${origin}/events/feed/`;
    case 'communice':
      return one(alternateFeeds(html, pageUrl).filter(f => /veranstaltung/i.test(f.href)).map(f => f.href))
        // auch …/veranstaltungskalender/rss (Mitteldithmarschen)
        ?? one(hrefs(html, pageUrl, /veranstaltung[^"'?#]*\/rss\b/i));
    case 'tribe':
      // Fester REST-Pfad des Plugins (theeventscalendar.com, an 4 von 4 Gemeinden belegt).
      return /tribe-events|the-events-calendar/i.test(html) ? `${origin}/wp-json/tribe/events/v1/events` : null;
    case 'eventsmanager':
      // Fester iCal-Pfad laut Hersteller (wp-events-plugin.com/docs-v1/event-ical-feeds).
      return /plugins\/events-manager\//i.test(html) ? `${origin}/events.ics` : null;
    default:
      return null;
  }
}

/**
 * Belegte Standardseiten des Kalenders je Hersteller, die der Builder abfragt,
 * wenn die Seite aus der Vollerhebung keinen Feed nennt (oft hat der Linkfinder
 * eine Termin- oder Detailseite erwischt). Übernommen wird nur, was die Seite
 * dann selbst nennt und der Abruf bestätigt.
 */
export function calendarPageCandidates(integration: string, origin: string): string[] {
  switch (integration) {
    case 'ionas': return ['/kalender/', '/veranstaltungen/', '/termine/'].map(p => origin + p); // amt-sn.de /kalender/
    case 'nolis': return [`${origin}/regional/veranstaltungen/sucheplus.html`]; // 00-bundesweit C2
    case 'communice': return [`${origin}/veranstaltungen`]; // 03-schleswig-holstein
    default: return [];
  }
}

/** Erwartetes Format des Feeds je Integration (für die Prüfung beim Abruf). */
export function feedFormat(integration: string): 'json' | 'ics' | 'xml' | null {
  switch (integration) {
    case 'ionas': case 'tribe': case 'cross7': case 'heimatinfo': return 'json';
    case 'nolis': case 'eventsmanager': case 'dpcalendar': return 'ics';
    case 'komm1': case 'mec': case 'jevents': case 'icagenda': case 'communice': return 'xml';
    default: return null;
  }
}

/** Trägt der Abruf einen Feed im erwarteten Format? */
export function looksLikeFeed(format: 'json' | 'ics' | 'xml', body: string): boolean {
  const t = body.replace(/^﻿/, '').trimStart();
  if (format === 'ics') return /^BEGIN:VCALENDAR/i.test(t);
  if (format === 'xml') return /^(<\?xml[^>]*>\s*)?(<\?xml-stylesheet[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(t);
  try {
    const j = JSON.parse(t) as unknown;
    return Array.isArray(j) || (typeof j === 'object' && j !== null && ('events' in j || 'items' in j));
  } catch {
    return false;
  }
}

/** Heimat-Info: Termine je Kommune über die offene API (00-bundesweit A1). */
export function heimatInfoFeedUrl(communeId: string): string {
  return `https://heimatinfo-api-platform.azurewebsites.net/communes/${communeId}/events`;
}
