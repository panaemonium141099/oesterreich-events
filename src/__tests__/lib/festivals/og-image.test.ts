import { describe, it, expect } from 'vitest';
import { extractOgImage, imageDims } from '@/lib/festivals/og-image';

describe('extractOgImage', () => {
  it('nimmt og:image und macht relative Pfade absolut', () => {
    const html = '<html><head><meta property="og:image" content="/sujet/2027.jpg"></head></html>';
    expect(extractOgImage(html, 'https://www.novarock.at/de/')).toBe('https://www.novarock.at/sujet/2027.jpg');
  });

  it('bevorzugt og:image:secure_url, fällt auf twitter:image zurück', () => {
    expect(extractOgImage(
      '<meta property="og:image:secure_url" content="https://a/s.jpg"><meta property="og:image" content="http://a/x.jpg">',
      'https://a/',
    )).toBe('https://a/s.jpg');
    expect(extractOgImage('<meta name="twitter:image" content="https://a/t.png">', 'https://a/')).toBe('https://a/t.png');
  });

  it('überspringt Logos und Platzhalter, nimmt dann JSON-LD', () => {
    const html = `
      <meta property="og:image" content="https://a/img/logo.png">
      <script type="application/ld+json">{"@graph":[{"@type":"Festival","image":{"url":"https://a/keyvisual.jpg"}}]}</script>`;
    expect(extractOgImage(html, 'https://a/')).toBe('https://a/keyvisual.jpg');
  });

  it('liefert null ohne Bildverweis oder bei kaputtem JSON-LD', () => {
    expect(extractOgImage('<html><body>nichts</body></html>', 'https://a/')).toBeNull();
    expect(extractOgImage('<script type="application/ld+json">{nope</script>', 'https://a/')).toBeNull();
  });
});

describe('imageDims', () => {
  it('liest PNG-IHDR', () => {
    const buf = Buffer.alloc(32);
    buf[0] = 0x89; buf[1] = 0x50;
    buf.writeUInt32BE(1200, 16); buf.writeUInt32BE(630, 20);
    expect(imageDims(buf)).toEqual({ w: 1200, h: 630 });
  });

  it('liest JPEG-SOF0', () => {
    // FFD8, dann APP0-Segment (Länge 16), dann SOF0 mit 630x1200
    const buf = Buffer.alloc(40);
    buf[0] = 0xff; buf[1] = 0xd8;
    buf[2] = 0xff; buf[3] = 0xe0; buf.writeUInt16BE(16, 4);
    const sof = 2 + 2 + 16;
    buf[sof] = 0xff; buf[sof + 1] = 0xc0; buf.writeUInt16BE(17, sof + 2);
    buf.writeUInt16BE(630, sof + 5); buf.writeUInt16BE(1200, sof + 7);
    expect(imageDims(buf)).toEqual({ w: 1200, h: 630 });
  });

  it('gibt null für unbekannte Formate', () => {
    expect(imageDims(Buffer.from('GIF89a'))).toBeNull();
  });
});
