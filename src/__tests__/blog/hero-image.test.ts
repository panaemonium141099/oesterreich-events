import { describe, it, expect } from 'vitest';
import {
  isRelevantCommonsFile, layoutFor, imageDims, COVER_HERO_WIDTH,
} from '@/lib/blog/hero-image';

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/';

describe('isRelevantCommonsFile', () => {
  it('weist den Treffer zurueck, der den Bug ausgeloest hat', () => {
    // "Science Busters for Kids" landete auf dem Cover von "YANK The Army
    // Weekly" vom 9. Maerz 1945, weil dort "Burma Bridge Busters" stand.
    expect(isRelevantCommonsFile(
      'Science Busters for Kids',
      `${COMMONS}YANK_The_Army_Weekly_1945-03-09.jpg`,
    )).toBe(false);
  });

  it('laesst einen echten Themen-Treffer durch', () => {
    expect(isRelevantCommonsFile(
      'Christkindlmarkt Wien Rathausplatz',
      `${COMMONS}Wiener_Christkindlmarkt_Rathausplatz_2019.jpg`,
    )).toBe(true);
  });

  it('matcht auch ueber URL-Encoding hinweg', () => {
    expect(isRelevantCommonsFile(
      'Krampuslauf Perchten',
      `${COMMONS}Krampuslauf%20Salzburg%202018.jpg`,
    )).toBe(true);
  });

  it('ignoriert Bindestriche und Unterstriche im Dateinamen', () => {
    expect(isRelevantCommonsFile(
      'Graz Uhrturm Schlossberg',
      `${COMMONS}Graz-Schlossberg-Uhrturm.jpg`,
    )).toBe(true);
  });

  it('laesst sich nicht von Fuellwoertern austricksen', () => {
    // "Konzert" und "Oesterreich" sind Stoppwoerter: sie stehen in unzaehligen
    // Dateinamen und wuerden sonst jeden beliebigen Treffer legitimieren.
    expect(isRelevantCommonsFile(
      'Konzert in Österreich',
      `${COMMONS}Konzert_Hamburg_Elbphilharmonie.jpg`,
    )).toBe(false);
  });

  it('weist eine Anfrage ohne aussagekraeftige Tokens komplett zurueck', () => {
    expect(isRelevantCommonsFile('The Live Show', `${COMMONS}Live_Show.jpg`)).toBe(false);
  });

  it('ignoriert zu kurze Tokens', () => {
    expect(isRelevantCommonsFile('Ars Electronica', `${COMMONS}Ars_Poetica.jpg`)).toBe(false);
  });
});

describe('layoutFor', () => {
  it('nimmt fuer ein Eventim-Artwork das Poster-Layout', () => {
    expect(layoutFor(222)).toBe('poster');
  });

  it('nimmt fuer ein breites Motiv den full-bleed-Hero', () => {
    expect(layoutFor(1800)).toBe('cover');
  });

  it('schaltet genau an der Schwelle um', () => {
    expect(layoutFor(COVER_HERO_WIDTH - 1)).toBe('poster');
    expect(layoutFor(COVER_HERO_WIDTH)).toBe('cover');
  });
});

describe('imageDims', () => {
  it('liest die Groesse aus einem PNG-Header', () => {
    const buf = Buffer.alloc(32);
    buf[0] = 0x89; buf[1] = 0x50;
    buf.writeUInt32BE(1920, 16);
    buf.writeUInt32BE(1080, 20);
    expect(imageDims(buf)).toEqual({ w: 1920, h: 1080 });
  });

  it('liest die Groesse aus einem JPEG-SOF0-Marker', () => {
    // SOI, dann ein SOF0-Segment. Der Marker liegt bei i=2, Hoehe steht auf
    // i+5, Breite auf i+7 — so wie ein Eventim-Artwork mit 222x222 aussieht.
    const buf = Buffer.alloc(24);
    buf[0] = 0xff; buf[1] = 0xd8;
    buf[2] = 0xff; buf[3] = 0xc0;
    buf.writeUInt16BE(17, 4);      // Segmentlaenge
    buf.writeUInt16BE(222, 2 + 5); // Hoehe
    buf.writeUInt16BE(222, 2 + 7); // Breite
    expect(imageDims(buf)).toEqual({ w: 222, h: 222 });
  });

  it('gibt null zurueck, wenn das Format unbekannt ist', () => {
    expect(imageDims(Buffer.from('not an image at all, really'))).toBeNull();
  });
});
