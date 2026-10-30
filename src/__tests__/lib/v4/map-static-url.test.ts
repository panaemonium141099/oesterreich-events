import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  AUSTRIA_CAMERA,
  MAPBOX_STATIC_URL_LIMIT,
  MAX_MAP_PINS,
  collectMapPins,
  mapStaticImage,
  mapStaticUrl,
  normalizeMapPins,
} from '@/lib/v4/map-static-url';

const opts = { token: 'pk.test', width: 640, height: 400 };

describe('normalizeMapPins', () => {
  it('rundet auf vier Stellen, entfernt Dubletten, sortiert und kappt bei 40', () => {
    const pins = normalizeMapPins([
      { lng: 16.37312, lat: 48.20849 },
      { lng: 16.3731, lat: 48.2085 },      // dieselbe Stelle nach Rundung
      { lng: 13.0433, lat: 47.8095 },
      { lng: Number.NaN, lat: 1 },
    ]);
    expect(pins).toEqual([{ lng: 13.0433, lat: 47.8095 }, { lng: 16.3731, lat: 48.2085 }]);

    const many = Array.from({ length: 60 }, (_, i) => ({ lng: 9.5 + i * 0.1, lat: 47 + i * 0.01 }));
    expect(normalizeMapPins(many)).toHaveLength(MAX_MAP_PINS);
  });

  it('die URL hängt nur von der Pin-Menge ab, nicht von der Reihenfolge', () => {
    const a = [{ lng: 16.37, lat: 48.21 }, { lng: 13.04, lat: 47.81 }];
    expect(mapStaticUrl(a, opts)).toBe(mapStaticUrl([...a].reverse(), opts));
  });
});

describe('mapStaticUrl', () => {
  it('ohne Pins der feste Österreich-Ausschnitt, Logo bleibt an', () => {
    const url = mapStaticUrl([], opts);
    expect(url).toContain(`/static/${AUSTRIA_CAMERA.lng},${AUSTRIA_CAMERA.lat},${AUSTRIA_CAMERA.zoom},0/640x400?`);
    expect(url).toContain('mapbox/dark-v11');
    expect(url).not.toContain('logo=false');
    expect(url).toContain('access_token=pk.test');
  });

  it('mit 40 Pins bleibt die URL unter 8.192 Zeichen', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ lng: 9.5 + i * 0.1234, lat: 46.3 + i * 0.0567 }));
    const url = mapStaticUrl(many, opts);
    expect(url.length).toBeLessThan(MAPBOX_STATIC_URL_LIMIT);
    expect(url.match(/pin-s\+/g)).toHaveLength(40);
    expect(url).toContain(`/${AUSTRIA_CAMERA.lng},${AUSTRIA_CAMERA.lat},${AUSTRIA_CAMERA.zoom},0/`);
  });

  it('übergroße Token-/Pin-Kombinationen verlieren Pins statt das Limit zu reißen', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ lng: 9.5 + i * 0.1234, lat: 46.3 + i * 0.0567 }));
    const url = mapStaticUrl(many, { ...opts, token: 'x'.repeat(7600) });
    expect(url.length).toBeLessThan(MAPBOX_STATIC_URL_LIMIT);
    expect((url.match(/pin-s\+/g) ?? []).length).toBeLessThan(40);
  });

  it('mapStaticImage liefert 1x/2x oder null ohne Token', () => {
    expect(mapStaticImage([], { ...opts, token: undefined })).toBeNull();
    const img = mapStaticImage([{ lng: 16.37, lat: 48.21 }], opts)!;
    expect(img.src).toContain('/640x400?');
    expect(img.srcSet).toMatch(/^https:[^ ]+\/640x400\?[^ ]+ 1x, https:[^ ]+\/640x400@2x\?[^ ]+ 2x$/);
  });
});

describe('collectMapPins', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('nimmt nur Events mit Koordinaten', () => {
    const pins = collectMapPins([
      { latitude: 48.21, longitude: 16.37 },
      { latitude: null, longitude: null },
      { latitude: 47.81, longitude: 13.04 },
    ]);
    expect(pins).toEqual([{ lng: 13.04, lat: 47.81 }, { lng: 16.37, lat: 48.21 }]);
  });

  it('mit Gating fällt eine Koordinate ohne Pin-Freigabe weg', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCATION_GATING', '1');
    const pins = collectMapPins([
      { latitude: 48.21, longitude: 16.37, location_resolution: { allowed: { pin: true } } },
      { latitude: 47.81, longitude: 13.04, location_resolution: { allowed: { pin: false } } },
      { latitude: 47.07, longitude: 15.43, location_status: 'municipality_only' },
    ]);
    expect(pins).toEqual([{ lng: 16.37, lat: 48.21 }]);
  });
});
