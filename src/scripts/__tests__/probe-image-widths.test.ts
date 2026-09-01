import { describe, it, expect } from 'vitest';
import { imageWidthOf } from '../probe-image-widths';

function pngHeader(width: number): Buffer {
  const b = Buffer.alloc(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // Signatur
  b.writeUInt32BE(13, 8);                                    // IHDR-Länge
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(width, 20);                                // Höhe egal
  return b;
}

function gifHeader(width: number): Buffer {
  const b = Buffer.alloc(13);
  b.write('GIF89a', 0);
  b.writeUInt16LE(width, 6);
  return b;
}

function jpegHeader(width: number): Buffer {
  // FFD8 (SOI) + FFE0 APP0 (Länge 16) + FFC0 SOF0 mit Breite
  const app0 = Buffer.alloc(20);
  app0.set([0xff, 0xd8, 0xff, 0xe0]);
  app0.writeUInt16BE(16, 4);
  const sof = Buffer.alloc(12);
  sof.set([0xff, 0xc0]);
  sof.writeUInt16BE(10, 2);  // Segment-Länge
  sof[4] = 8;                // Präzision
  sof.writeUInt16BE(999, 5); // Höhe
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([app0, sof]);
}

describe('imageWidthOf', () => {
  it('liest PNG-Breite aus dem IHDR', () => {
    expect(imageWidthOf(pngHeader(1280))).toBe(1280);
    expect(imageWidthOf(pngHeader(222))).toBe(222);
  });

  it('liest GIF-Breite little-endian', () => {
    expect(imageWidthOf(gifHeader(640))).toBe(640);
  });

  it('scannt JPEG-Marker bis zum SOF0', () => {
    expect(imageWidthOf(jpegHeader(222))).toBe(222);
    expect(imageWidthOf(jpegHeader(1920))).toBe(1920);
  });

  it('liefert null für Nicht-Bilder und Mini-Buffer', () => {
    expect(imageWidthOf(Buffer.from('<html>not an image</html>'))).toBe(null);
    expect(imageWidthOf(Buffer.alloc(4))).toBe(null);
  });
});
