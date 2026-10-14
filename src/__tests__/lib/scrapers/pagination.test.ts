import { describe, it, expect } from 'vitest';
import { detectNextPage, isNextLabel } from '@/lib/scrapers/pagination';

// Fixtures nach echten Gemeinde-Seiten (Stichprobe 2026-10-14), auf die
// Pager- und Menü-Markup gekürzt.

const page = (body: string, head = '') => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

/** Menü einer RiS/GEM2GO-Seite: Teilwörter "vor"/"weiter" überall */
const RIS_MENU = `
  <ul class="Menu">
    <li class="Menu-Leaf"><a class="Menu-Link" href="/Politik/Gemeindevorstand">Gemeindevorstand</a></li>
    <li class="Menu-Leaf"><a class="Menu-Link" href="/Buergerservice/Information/Weitere_Informationen" title="Weitere Informationen von oesterreich.gv.at">Weitere Informationen</a></li>
    <li class="Menu-Leaf"><a class="Menu-Link" href="/Gemeindeamt/Finanzdaten" title="Voranschläge, Rechnungsabschlüsse, MFP">Finanzdaten</a></li>
    <li class="Menu-Leaf"><a class="Menu-Link extlink" href="https://pvn-mav.at/" title="Ärztenetzwerk Alpenvorland (Externer Link)">Ärztenetzwerk Alpenvorland</a></li>
  </ul>`;

describe('detectNextPage: keine Folgeseite aus Menü, Dateien und fremden Hosts', () => {
  it('Strobl: "Voranschlag 2026" (GetDocument.ashx, PDF ohne Endung) ist keine Seite 2', () => {
    const url = 'https://www.strobl.salzburg.at/system/web/default.aspx';
    const html = page(`${RIS_MENU}
      <a data-file-modal="openFileModal" class="piwik_download" href="/system/web/GetDocument.ashx?cts=1785831494&amp;fileId=2225464&amp;name=Datei%20vorhandenDatei%20herunterladen%20-%20pdf74%20MB&amp;ncd=1" title="Voranschlag 2026 - Links (externe Seite)">Voranschlag 2026</a>
      <div class="event"><h3>54. Int. Wolfgangseelauf</h3><p>17.10.2026</p></div>`);
    expect(detectNextPage(html, url)).toEqual({ nextUrl: null, type: 'none' });
  });

  it.each([
    ['Gemeindevorstand', '<a href="/Politik/Gemeindevorstand">Gemeindevorstand</a>'],
    ['Weitere Informationen', '<a href="/Weitere_Informationen">Weitere Informationen</a>'],
    ['Vortrag als Teaser', '<a href="/Vortrag_Bioenergetik" title="Vortrag - Bioenergetische Geistheilung"><img src="x.jpg"></a>'],
    ['Weiterlesen', '<a href="/news/sanierung">Weiterlesen »</a>'],
    ['Vorige Seite', '<a class="pager" title="Vorige Seite" href="?page=0"> &lt; </a>'],
    ['Vorherige Veranstaltungen', '<a href="/Veranstaltungen/Liste/?eventDisplay=past" aria-label="Vorherige Veranstaltungen" title="Vorherige Veranstaltungen"></a>'],
    ['Menüpunkt mit Pfeil', '<a class="context-nav__link" href="/veranstaltungen">Veranstaltungen›</a>'],
    ['Überschrift "Nächste Veranstaltung"', '<h2><a href="/Veranstaltungen">Nächste Veranstaltung</a></h2>'],
  ])('%s', (_name, link) => {
    const html = page(`${RIS_MENU}${link}`);
    expect(detectNextPage(html, 'https://www.gemeinde.at/veranstaltungen.html').nextUrl).toBeNull();
  });

  it('"Weiter" auf eine fremde Website zählt nicht', () => {
    const html = page('<a href="https://www.vorarlberg.at/veranstaltungen?page=2">Weiter</a>');
    expect(detectNextPage(html, 'https://www.satteins.net/veranstaltungen').nextUrl).toBeNull();
  });

  it('Dateien und Download-Links zählen nicht, auch mit Weiter-Beschriftung', () => {
    for (const link of [
      '<a href="/fileadmin/kalender/seite-2.pdf">Nächste Seite</a>',
      '<a href="/termine?page=2" download>Nächste Seite</a>',
      '<a href="/system/web/GetDocument.ashx?fileId=1&amp;page=2">Weiter »</a>',
      '<ul class="pagination"><li><a href="/files/programm.docx">»</a></li></ul>',
    ]) {
      expect(detectNextPage(page(link), 'https://www.gemeinde.at/termine').nextUrl).toBeNull();
    }
  });

  it('ein Link auf die Seite selbst ist keine Folgeseite (St. Georgen "Weitere")', () => {
    const url = 'https://www.gemeinde.at/system/web/kalender.aspx?vdatum=01.04.2027';
    const html = page('<a href="/system/web/kalender.aspx?vdatum=01.04.2027">»</a>');
    expect(detectNextPage(html, url).nextUrl).toBeNull();
  });
});

describe('detectNextPage: echte Pager', () => {
  it('RiS/GEM2GO mit pager_container: Seite 1 → Seite 2', () => {
    const url = 'https://www.alkoven.at/system/web/veranstaltung.aspx?menuonr=220469297&page=0';
    const html = page(`${RIS_MENU}
      <p class="pager_container">
        <span class="pager_sel">1 </span><span class="none">|</span>
        <a href="/system/web/veranstaltung.aspx?menuonr=220469297&amp;page=1" title="Seite 2" class="pager">2</a><span class="none">|</span>
        <a href="/system/web/veranstaltung.aspx?menuonr=220469297&amp;page=2" title="Seite 3" class="pager">3</a>
        <a href="/system/web/veranstaltung.aspx?menuonr=220469297&amp;page=1" title="Nächste Seite" class="pager"> &gt; </a>
        <a href="/system/web/veranstaltung.aspx?menuonr=220469297&amp;page=2" title="Letzte Seite" class="pager"> &gt;| </a>
      </p>`);
    expect(detectNextPage(html, url)).toEqual({
      nextUrl: 'https://www.alkoven.at/system/web/veranstaltung.aspx?menuonr=220469297&page=1',
      type: 'next-link',
    });
  });

  // Hainfeld: Pager ohne Container-Klasse, rel="Next" steht auch auf "Seite 1"
  const hainfeldPager = (current: number, last: number) => {
    const link = (p: number, label: string, title: string, rel = '') =>
      `<a class="pager" title="${title}"${rel} href="/system/web/veranstaltung.aspx?menuonr=226050432&amp;page=${p}">${label}</a>`;
    const parts: string[] = [];
    if (current > 0) parts.push(link(0, ' |&lt; ', 'Erste Seite', ' rel="Start"'), link(current - 1, ' &lt; ', 'Vorige Seite'));
    for (let p = 0; p <= last; p++) {
      parts.push(p === current ? `<span class="pager_sel">${p + 1} </span>` : link(p, String(p + 1), `Seite ${p + 1}`, ' rel="Next"'));
    }
    if (current < last) parts.push(link(current + 1, ' &gt; ', 'Nächste Seite', ' rel="Next"'), link(last, ' &gt;| ', 'Letzte Seite', ' rel="Next"'));
    return page(`${RIS_MENU}<div class="va_content"><p>${parts.join('<span class="none">|</span>')}</p></div>`);
  };
  const hainfeldUrl = (p: number) => `https://www.hainfeld.gv.at/system/web/veranstaltung.aspx?menuonr=226050432&page=${p}`;

  it('RiS ohne Container-Klasse: Seite 2 von 3 → Seite 3, nicht zurück', () => {
    expect(detectNextPage(hainfeldPager(1, 2), hainfeldUrl(1)).nextUrl).toBe(hainfeldUrl(2));
  });

  it('RiS letzte Seite: Ende statt rel="Next" auf "Seite 1"', () => {
    expect(detectNextPage(hainfeldPager(2, 2), hainfeldUrl(2))).toEqual({ nextUrl: null, type: 'none' });
  });

  it('Seitenzahl "2" nach der aktuellen Seite (Events Manager ohne Weiter-Pfeil)', () => {
    const html = page(`<div class="em-pagination em-ajax">
      <span class="page-numbers current">1</span>
      <a class="page-numbers" href="/termine/?pno=2" title="2">2</a>
      <a class="page-numbers" href="/termine/?pno=3" title="3">3</a>
    </div>`);
    expect(detectNextPage(html, 'https://www.gaenserndorf.at/termine/')).toEqual({
      nextUrl: 'https://www.gaenserndorf.at/termine/?pno=2',
      type: 'numbered',
    });
  });

  it('Reiter nach dem aktiven Element ist keine Seitenzahl', () => {
    const html = page(`<ul class="pages">
      <li class="active"><a href="/pages/neudorf">Übersicht</a></li>
      <li><a href="/pages/neudorf/posts">Beiträge</a></li>
    </ul>`);
    expect(detectNextPage(html, 'https://citiesapps.com/pages/neudorf').nextUrl).toBeNull();
  });

  it('The Events Calendar: "Nächste Veranstaltungen" im Paginierungs-Nav, "Vorherige" nicht', () => {
    const html = page(`<nav class="tribe-events-c-top-bar__nav" aria-label="Top Veranstaltungen Liste Paginierung"><ul>
      <li><a href="https://www.wiener-neudorf.gv.at/events/liste/?eventDisplay=past" class="tribe-events-c-top-bar__nav-link--prev" aria-label="Vorherige Veranstaltungen" title="Vorherige Veranstaltungen"><svg></svg></a></li>
      <li><a href="https://www.wiener-neudorf.gv.at/events/liste/seite/2/" class="tribe-events-c-top-bar__nav-link--next" aria-label="Nächste Veranstaltungen" title="Nächste Veranstaltungen"><svg></svg></a></li>
    </ul></nav>`);
    expect(detectNextPage(html, 'https://www.wiener-neudorf.gv.at/events/liste/').nextUrl)
      .toBe('https://www.wiener-neudorf.gv.at/events/liste/seite/2/');
  });

  it('"Nächste Veranstaltungen" außerhalb eines Pagers, wenn das Ziel eine Seite der Liste ist', () => {
    const html = page(`${RIS_MENU}<a href="/events/liste/seite/2/">Nächste Veranstaltungen »</a>`);
    expect(detectNextPage(html, 'https://www.gemeinde.at/events/liste/').nextUrl)
      .toBe('https://www.gemeinde.at/events/liste/seite/2/');
  });

  it('WordPress /page/2/', () => {
    const html = page(`<div class="nav-links"><a class="page-numbers" href="https://www.unterrabnitz.at/events/page/2/">2</a></div>`);
    expect(detectNextPage(html, 'https://www.unterrabnitz.at/events/').nextUrl).toBe('https://www.unterrabnitz.at/events/page/2/');
  });

  it('zweite Domain derselben Gemeinde zählt über canonical (Trausdorf .gv.at / .at)', () => {
    const html = page(
      `<ul class="pagination"><li class="active"><span>1</span></li><li><a href="https://www.trausdorf-wulka.at/events/page/2/">2</a></li></ul>`,
      '<link rel="canonical" href="https://www.trausdorf-wulka.at/events/">',
    );
    expect(detectNextPage(html, 'https://www.trausdorf-wulka.gv.at/events/').nextUrl).toBe('https://www.trausdorf-wulka.at/events/page/2/');
  });
});

describe('isNextLabel', () => {
  it.each([
    'Nächste Seite', 'Weiter', 'weiter »', '»', '›', '>', 'Next', 'Nächste Veranstaltungen',
    'Weiter zur nächsten Seite', 'vor', 'Nächster Monat',
  ])('erkennt %s', (label) => {
    expect(isNextLabel(label)).toBe(true);
  });

  it.each([
    'Voranschlag 2026', 'Gemeindevorstand', 'Weitere Informationen', 'Weitere', 'Weiterbildung',
    'Vorige Seite', 'Vorherige Veranstaltungen', '>|', '|<', '<', 'Letzte Seite', 'Seite 2',
    'Veranstaltungen ›', 'Nächste Veranstaltung', 'Nächste Amtsstunden in Kroatisch Geresdorf',
    'weiterlesen', 'Vorarlberg', '',
  ])('verwirft %s', (label) => {
    expect(isNextLabel(label)).toBe(false);
  });
});
