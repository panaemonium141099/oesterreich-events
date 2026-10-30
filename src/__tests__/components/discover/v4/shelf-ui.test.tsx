import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Shelf } from '@/components/Discover/v4/shelf-ui';

/**
 * Regal-Spur ohne Überhang (fn-30.8): Die Spur endet an der Inhaltskante
 * (keine negativen Ränder, kein scroll-padding), heißt für Screenreader
 * wie ihr Regal und meldet per `data-more`, ob rechts noch Karten liegen.
 * Den Verlauf dazu und den innen liegenden Fokusring hält globals.css.
 */

const ROOT = path.resolve(__dirname, '../../../../..');

/** happy-dom misst kein Layout; Scrollmaße kommen aus diesen Variablen. */
let scrollWidth = 0;
let clientWidth = 0;
let scrollLeft = 0;
const proto = HTMLElement.prototype;
const original = {
  scrollWidth: Object.getOwnPropertyDescriptor(proto, 'scrollWidth'),
  clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
  scrollLeft: Object.getOwnPropertyDescriptor(proto, 'scrollLeft'),
};
Object.defineProperty(proto, 'scrollWidth', { configurable: true, get: () => scrollWidth });
Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => clientWidth });
Object.defineProperty(proto, 'scrollLeft', {
  configurable: true,
  get: () => scrollLeft,
  set: (v: number) => { scrollLeft = v; },
});

afterEach(() => {
  scrollWidth = 0;
  clientWidth = 0;
  scrollLeft = 0;
});

afterAll(() => {
  for (const [key, desc] of Object.entries(original)) {
    if (desc) Object.defineProperty(proto, key, desc);
    else delete (proto as unknown as Record<string, unknown>)[key];
  }
});

function renderShelf(title = 'Heute Abend') {
  render(
    <Shelf title={title}>
      <a href="/a">Karte A</a>
      <a href="/b">Karte B</a>
    </Shelf>,
  );
  return screen.getByRole('region', { name: title });
}

describe('Shelf: Spur ohne Überhang', () => {
  it('endet an der Inhaltskante: keine negativen Ränder, kein scroll-padding, Snap bleibt', () => {
    scrollWidth = 1200; clientWidth = 400;
    const track = renderShelf();
    const cls = track.className;
    expect(cls).not.toMatch(/-mx-/);
    expect(cls).not.toMatch(/\bpx-/);
    expect(cls).not.toMatch(/scroll-padding/);
    expect(cls).toMatch(/\bsnap-x\b/);
    expect(cls).toMatch(/\boverflow-x-auto\b/);
    expect(cls).toMatch(/\bv4-shelf-track\b/);
    // Platz für den Fokusring oben und unten.
    expect(cls).toMatch(/\bpt-1\b/);
    expect(cls).toMatch(/\bpb-1\.5\b/);
  });

  it('heißt für Screenreader wie das Regal', () => {
    const track = renderShelf('Dieses Wochenende');
    expect(track).toHaveAttribute('role', 'region');
    expect(track).toHaveAttribute('aria-label', 'Dieses Wochenende');
    expect(track).toContainElement(screen.getByText('Karte A'));
  });

  it('meldet data-more, solange rechts noch Karten liegen', () => {
    scrollWidth = 1200; clientWidth = 400; scrollLeft = 0;
    const track = renderShelf();
    expect(track).toHaveAttribute('data-more');

    scrollLeft = 800; // Ende erreicht
    fireEvent.scroll(track);
    expect(track).not.toHaveAttribute('data-more');

    scrollLeft = 300;
    fireEvent.scroll(track);
    expect(track).toHaveAttribute('data-more');
  });

  it('zeigt keinen Hinweis, wenn die Spur gar nicht scrollt', async () => {
    scrollWidth = 380; clientWidth = 400;
    const track = renderShelf();
    await act(async () => {});
    expect(track).not.toHaveAttribute('data-more');
  });
});

describe('globals.css: Verlauf und Fokusring der Spur', () => {
  const css = readFileSync(path.join(ROOT, 'src/app/[locale]/globals.css'), 'utf-8');

  it('legt den Fokusring innen, damit die Spur ihn nicht abschneidet', () => {
    expect(css).toMatch(/\.v4-shelf-track > :focus-visible\s*\{[^}]*outline-offset:\s*-\d+px/);
  });

  it('blendet auf dem Handy rechts aus, nur mit data-more und nur unter md', () => {
    const block = css.match(/@media \(max-width: 767px\)\s*\{\s*\.v4-shelf-track\[data-more\]\s*\{([^}]*)\}/);
    expect(block, 'Mobile-Regel .v4-shelf-track[data-more] fehlt').not.toBeNull();
    expect(block![1]).toMatch(/mask-image:\s*linear-gradient\(to right/);
    expect(block![1]).toMatch(/-webkit-mask-image:/);
    expect(block![1]).toMatch(/transparent/);
  });
});

describe('Konsumenten: keine eigene Spur mit Überhang mehr', () => {
  it.each([
    'src/components/Discover/v4/shelf-ui.tsx',
    'src/components/Discover/v4/V4SmartPlanner.tsx',
    'src/components/Discover/v4/V4EntdeckenShelves.tsx',
    'src/components/Hub/HubShelves.tsx',
    'src/components/Hub/HubEventGrid.tsx',
    'src/components/Landing/LoadMoreEvents.tsx',
    'src/app/[locale]/thema/[slug]/page.tsx',
    'src/app/[locale]/studenten/page.tsx',
  ])('%s', (file) => {
    const src = readFileSync(path.join(ROOT, file), 'utf-8');
    expect(src).not.toMatch(/md:-mx-14/);
    expect(src).not.toMatch(/scroll-padding-left/);
  });
});
