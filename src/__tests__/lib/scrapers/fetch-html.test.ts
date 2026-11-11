import { describe, it, expect, vi, afterEach } from 'vitest';
import { decodeHtml, fetchHtml, readHtml, MAX_HTML_BYTES } from '@/lib/scrapers/fetch-html';
import { BaseScraper } from '@/lib/scrapers/BaseScraper';
import { Gem2GoScraper } from '@/lib/scrapers/Gem2GoScraper';
import { discoverEventListUrl } from '@/lib/scrapers/gemeinde-event-discovery';
import type { ScrapedEvent } from '@/types/events';

/**
 * Body als Stream, der mitzählt, wie viele Chunks gelesen wurden und ob er
 * abgebrochen wurde. `chunks` = Infinity simuliert einen Endlos-Download.
 */
function countingBody(chunkSize: number, chunks: number, fill = 0x41) {
  const state = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) { controller.close(); return; }
      state.pulled++;
      controller.enqueue(new Uint8Array(chunkSize).fill(fill));
    },
    cancel() { state.cancelled = true; },
  });
  return { stream, state };
}

function stubFetch(response: Response | (() => Promise<Response>)) {
  const fn = vi.fn(typeof response === 'function' ? response : async () => response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchHtml', () => {
  it('liefert HTML (text/html; charset) als Text', async () => {
    stubFetch(new Response('<html><body>Ölkürbis</body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    const r = await fetchHtml('https://www.gemeinde.at/termine', { timeoutMs: 1000 });
    expect(r).toEqual({ html: '<html><body>Ölkürbis</body></html>' });
  });

  it('nimmt XHTML an', async () => {
    stubFetch(new Response('<html/>', { headers: { 'content-type': 'application/xhtml+xml' } }));
    expect((await fetchHtml('https://x.at/', { timeoutMs: 1000 })).html).toBe('<html/>');
  });

  it('Strobl: application/pdf wird abgewiesen, ohne den Body zu lesen', async () => {
    const { stream, state } = countingBody(64 * 1024, Infinity);
    stubFetch(new Response(stream, { headers: { 'content-type': 'application/pdf', 'content-length': '77669838' } }));
    const r = await fetchHtml('https://www.strobl.salzburg.at/system/web/GetDocument.ashx?fileId=2225464', { timeoutMs: 1000 });
    expect(r).toEqual({ html: null, error: 'kein HTML (application/pdf)', permanent: true });
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(1);
  });

  it('Content-Length über der Obergrenze: Abbruch vor dem Lesen', async () => {
    const { stream, state } = countingBody(64 * 1024, Infinity);
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/html', 'content-length': String(MAX_HTML_BYTES + 1) } }));
    const r = await fetchHtml('https://x.at/riesig', { timeoutMs: 1000 });
    expect(r.html).toBeNull();
    expect(r.error).toBe(`zu groß (${MAX_HTML_BYTES + 1} Bytes)`);
    expect(r.permanent).toBe(true);
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(1);
  });

  it('ohne Content-Length: bricht beim Lesen ab, sobald die Obergrenze überschritten ist', async () => {
    const { stream, state } = countingBody(1024, Infinity);
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/html' } }));
    const r = await fetchHtml('https://x.at/endlos', { timeoutMs: 1000, maxBytes: 10 * 1024 });
    expect(r).toEqual({ html: null, error: 'zu groß (über 10240 Bytes)', permanent: true });
    expect(state.cancelled).toBe(true);
    // 10 KiB erlaubt: der elfte Chunk löst den Abbruch aus (plus höchstens einer im Puffer)
    expect(state.pulled).toBeGreaterThanOrEqual(11);
    expect(state.pulled).toBeLessThanOrEqual(12);
  });

  it('ohne Content-Length unter der Obergrenze: ganzer Body', async () => {
    const { stream } = countingBody(1024, 3, 0x62);
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/html' } }));
    const r = await fetchHtml('https://x.at/klein', { timeoutMs: 1000, maxBytes: 10 * 1024 });
    expect(r.html).toBe('b'.repeat(3 * 1024));
  });

  it('text/plain ist kein HTML', async () => {
    stubFetch(new Response('<html>ok</html>', { headers: { 'content-type': 'text/plain; charset=utf-8' } }));
    expect((await fetchHtml('https://x.at/a', { timeoutMs: 1000 })).error).toBe('kein HTML (text/plain)');
  });

  it('ohne Content-Type: HTML ja, PDF nein', async () => {
    const bare = (body: string) => {
      const res = new Response(body);
      res.headers.delete('content-type');
      return res;
    };
    stubFetch(bare('<html>ok</html>'));
    expect((await fetchHtml('https://x.at/b', { timeoutMs: 1000 })).html).toBe('<html>ok</html>');
    stubFetch(bare('%PDF-1.7\n%âãÏÓ'));
    expect(await fetchHtml('https://x.at/c', { timeoutMs: 1000 })).toEqual({ html: null, error: 'kein HTML (binär)', permanent: true });
  });

  it('HTTP-Fehler: 4xx dauerhaft, 5xx vorübergehend', async () => {
    stubFetch(new Response('weg', { status: 404 }));
    expect(await fetchHtml('https://x.at/404', { timeoutMs: 1000 })).toEqual({ html: null, error: 'HTTP 404', permanent: true });
    stubFetch(new Response('kaputt', { status: 503 }));
    expect(await fetchHtml('https://x.at/503', { timeoutMs: 1000 })).toEqual({ html: null, error: 'HTTP 503', permanent: false });
  });

  it('Timeout meldet "timeout"', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const r = await fetchHtml('https://x.at/langsam', { timeoutMs: 20 });
    expect(r).toEqual({ html: null, error: 'timeout' });
  });
});

class TestScraper extends BaseScraper {
  readonly name = 'test-source';
  protected delayMs = 0;
  async scrape(): Promise<ScrapedEvent[]> { return []; }
  public get = (url: string, retries?: number) => this.fetchHtml(url, { timeoutMs: 1000, retries });
  protected log(): void { /* still */ }
}

describe('BaseScraper.fetchHtml', () => {
  it('wiederholt vorübergehende Fehler', async () => {
    const responses = [new Response('x', { status: 503 }), new Response('<p>ok</p>', { headers: { 'content-type': 'text/html' } })];
    const fn = stubFetch(async () => responses.shift()!);
    const r = await new TestScraper().get('https://x.at/', 3);
    expect(r.html).toBe('<p>ok</p>');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('wiederholt kein PDF und schickt die Scraper-Header mit', async () => {
    const fn = stubFetch(async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }));
    const r = await new TestScraper().get('https://x.at/doc', 3);
    expect(r.error).toBe('kein HTML (application/pdf)');
    expect(fn).toHaveBeenCalledTimes(1);
    const headers = (fn.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('BurgenlandEvents-Scraper');
    expect(headers['Accept']).toContain('text/html');
  });
});

describe('readHtml', () => {
  it('XML nur mit xml-Option (Sitemap)', async () => {
    const xml = () => new Response('<urlset/>', { headers: { 'content-type': 'application/xml; charset=utf-8' } });
    expect(await readHtml(xml())).toEqual({ html: null, error: 'kein HTML (application/xml)', permanent: true });
    expect((await readHtml(xml(), { xml: true })).html).toBe('<urlset/>');
    const pdf = new Response('%PDF', { headers: { 'content-type': 'application/pdf' } });
    expect((await readHtml(pdf, { xml: true })).error).toBe('kein HTML (application/pdf)');
  });
});

/** Antwort mit gesetzter URL, wie fetch sie nach Weiterleitungen liefert. */
function at(url: string, res: Response): Response {
  Object.defineProperty(res, 'url', { value: url });
  return res;
}

const pdfBody = () => countingBody(64 * 1024, Infinity, 0x25);

describe('Gem2GoScraper: Abrufe nur als HTML', () => {
  type Internals = { fetchWithTimeout(url: string, ms: number): Promise<string | null>; log(msg: string): void };
  function gem2go() {
    const s = new Gem2GoScraper() as unknown as Internals;
    const logs: string[] = [];
    s.log = (m) => { logs.push(m); };
    return { s, logs };
  }

  it('Uttendorf: Detail-Link GetDocument.ashx, 302 auf ein PDF, wird nicht gelesen', async () => {
    const doc = 'http://www.uttendorf.at/system/web/GetDocument.ashx?cts=1791897816&fileId=2249808&useFlipbook=true';
    const { stream, state } = pdfBody();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/system/web/GetDocument.ashx?fileId=2249808&file=1' } }))
      .mockResolvedValueOnce(new Response(stream, { headers: { 'content-type': 'application/pdf', 'content-length': '367814' } })));
    const { s, logs } = gem2go();
    expect(await s.fetchWithTimeout(doc, 1000)).toBeNull();
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(1);
    expect(logs).toEqual([`Übersprungen, kein HTML (application/pdf): ${doc}`]);
  });

  it('Strobl: PDF ohne Weiterleitung (77 MB) wird nicht gelesen', async () => {
    const { stream, state } = pdfBody();
    stubFetch(new Response(stream, { headers: { 'content-type': 'application/pdf', 'content-length': '77669838' } }));
    const { s } = gem2go();
    expect(await s.fetchWithTimeout('https://www.strobl.salzburg.at/system/web/GetDocument.ashx?fileId=2225464', 1000)).toBeNull();
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(1);
  });

  it('HTML ohne Content-Length über 5 MB: Abbruch beim Lesen', async () => {
    const { stream, state } = countingBody(1024 * 1024, Infinity);
    stubFetch(new Response(stream, { headers: { 'content-type': 'text/html' } }));
    const { s, logs } = gem2go();
    expect(await s.fetchWithTimeout('https://www.x.at/system/web/veranstaltung.aspx?sprache=1', 1000)).toBeNull();
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(7);
    expect(logs[0]).toContain('zu groß');
  });

  it('gem2go-Seite kommt unverändert durch', async () => {
    const html = '<html><body><table class="va_list_table"></table></body></html>';
    stubFetch(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    const { s, logs } = gem2go();
    expect(await s.fetchWithTimeout('https://www.x.at/system/web/veranstaltung.aspx?sprache=1', 1000)).toBe(html);
    expect(logs).toEqual([]);
  });
});

describe('Gemeinde-Homepage-Suche: Kandidaten nur als HTML', () => {
  const home = 'https://www.gemeinde.at';
  function route(pages: Record<string, () => Response>) {
    const fn = vi.fn(async (url: string) => at(url, pages[url]?.() ?? new Response('weg', { status: 404 })));
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  it('ein Dokument-Link mit "Veranstaltungskalender" wird abgerufen, aber nicht gelesen', async () => {
    const doc = `${home}/system/web/GetDocument.ashx?fileId=7`;
    const states: Array<{ pulled: number; cancelled: boolean }> = [];
    const html = (body: string) => () => new Response(`<html><body>${body}</body></html>`, { headers: { 'content-type': 'text/html' } });
    const fn = route({
      [home]: html(`<a href="/veranstaltungen">Veranstaltungen</a><a href="/system/web/GetDocument.ashx?fileId=7">Veranstaltungskalender 2026</a>`),
      [`${home}/veranstaltungen`]: html('<h1>Veranstaltungen</h1>'),
      [doc]: () => {
        const { stream, state } = pdfBody();
        states.push(state);
        return new Response(stream, { headers: { 'content-type': 'application/pdf' } });
      },
    });
    const r = await discoverEventListUrl(home);
    expect(fn.mock.calls.map((c) => c[0])).toContain(doc);
    expect(states.length).toBeGreaterThan(0);
    for (const st of states) {
      expect(st.cancelled).toBe(true);
      expect(st.pulled).toBeLessThanOrEqual(1);
    }
    expect(r?.url).toBe(`${home}/veranstaltungen`);
  });

  it('sitemap.xml (application/xml) wird weiter gelesen', async () => {
    route({
      [home]: () => new Response('<html><body><a href="/kontakt">Kontakt</a></body></html>', { headers: { 'content-type': 'text/html' } }),
      [`${home}/sitemap.xml`]: () => new Response(
        `<urlset><url><loc>${home}/veranstaltungen-liste</loc></url><url><loc>${home}/kontakt</loc></url></urlset>`,
        { headers: { 'content-type': 'application/xml' } },
      ),
    });
    expect(await discoverEventListUrl(home)).toEqual({ url: `${home}/veranstaltungen-liste`, eventCount: 0 });
  });
});

describe('Zeichensatz (Schalter charset, fn-29.13)', () => {
  const latin = Buffer.from('<p>Gemünden ¤</p>', 'latin1');

  it('ISO-8859-15 nach Content-Type bzw. <meta charset>, sonst UTF-8', () => {
    expect(decodeHtml(latin, 'text/html; charset=ISO-8859-15')).toBe('<p>Gemünden €</p>');
    expect(decodeHtml(Buffer.concat([Buffer.from('<meta charset="iso-8859-15">'), latin]), 'text/html')).toContain('Gemünden €');
    expect(decodeHtml(Buffer.from('<p>Gemünden</p>'), null)).toBe('<p>Gemünden</p>');
    expect(decodeHtml(Buffer.from('<p>Gemünden</p>'), 'text/html; charset=x-unbekannt')).toBe('<p>Gemünden</p>');
  });

  it('nur auf Wunsch: ohne Schalter bleibt es UTF-8 wie bisher', async () => {
    const res = () => new Response(latin, { headers: { 'content-type': 'text/html; charset=ISO-8859-15' } });
    expect((await readHtml(res())).html).toContain('Gem�nden');
    expect((await readHtml(res(), { charset: true })).html).toBe('<p>Gemünden €</p>');
  });
});
