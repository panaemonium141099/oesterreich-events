/**
 * Nachrichten je Seite (fn-31.4): lasstreffen.at bekommt die Basis
 * unverändert, lasstreffen.de die Überlagerung und die eigene Marke.
 */
import { describe, it, expect } from 'vitest';
import de from '../../../messages/de.json';
import deDE from '../../../messages/de.DE.json';
import {
  loadMessages,
  mergeMessages,
  messagesForSite,
  rebrandMessages,
  unknownOverlayKeys,
  type Messages,
} from '@/i18n/messages';
import { SITES } from '@/lib/site/sites';

const base = de as unknown as Messages;
const overlay = deDE as unknown as Messages;

/** Namensräume, die lasstreffen.de zum Start zeigt (Kern, siehe Feature-Matrix). */
const KERN = [
  'Nav', 'TabBar', 'Search', 'NotFound', 'Landing', 'Footer', 'MetaMap', 'MetaDiscover', 'Meta',
  'Categories', 'EventDetail', 'Discover', 'MapPage', 'ErrorPage', 'HubLanding', 'HubFAQ',
  'GemeindeHub', 'SmartSearch',
];

function strings(node: Messages, path: string[] = []): Array<[string, string]> {
  return Object.entries(node).flatMap(([k, v]) =>
    typeof v === 'string' ? [[[...path, k].join('.'), v] as [string, string]] : strings(v, [...path, k]),
  );
}

describe('mergeMessages', () => {
  it('überlagert Blätter und lässt Geschwister stehen', () => {
    const merged = mergeMessages({ a: { x: '1', y: '2' }, b: '3' }, { a: { x: 'neu' } });
    expect(merged).toEqual({ a: { x: 'neu', y: '2' }, b: '3' });
  });

  it('verändert die Basis nicht', () => {
    const b = { a: { x: '1' } };
    mergeMessages(b, { a: { x: 'neu' } });
    expect(b).toEqual({ a: { x: '1' } });
  });
});

describe('lasstreffen.at', () => {
  it('bekommt die Basis als dasselbe Objekt', async () => {
    expect(messagesForSite(base, overlay, SITES.AT)).toBe(base);
    expect(await loadMessages('de', SITES.AT)).toEqual(base);
  });
});

describe('lasstreffen.de', () => {
  const messages = messagesForSite(base, overlay, SITES.DE);

  it('jeder Schlüssel der Überlagerung existiert in der Basis', () => {
    expect(unknownOverlayKeys(base, overlay)).toEqual([]);
  });

  it('die Überlagerung behält die Platzhalter des Originals', () => {
    const original = new Map(strings(base));
    for (const [key, text] of strings(overlay)) {
      const want = [...(original.get(key) ?? '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      const got = [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      expect([key, got]).toEqual([key, want]);
    }
  });

  it('kein Text im Kern nennt Österreich oder die Marke der anderen Seite', () => {
    const treffer = strings(messages)
      .filter(([key]) => KERN.includes(key.split('.')[0]))
      .filter(([, text]) => /sterreich|austria|lasstreffen\.at/i.test(text))
      .map(([key]) => key);
    expect(treffer).toEqual([]);
  });

  it('die Marke ist überall ersetzt, auch außerhalb der Überlagerung', () => {
    expect(strings(messages).filter(([, t]) => t.includes(SITES.AT.brand))).toEqual([]);
    expect(strings(messages).some(([, t]) => t.includes(SITES.DE.brand))).toBe(true);
  });

  it('neue Texte tragen keine Gedankenstriche', () => {
    expect(strings(overlay).filter(([, t]) => /[–—]/.test(t)).map(([k]) => k)).toEqual([]);
  });

  it('lädt Basis plus Überlagerung', async () => {
    const loaded = await loadMessages('de', SITES.DE);
    expect((loaded.Discover as Messages).scopeAll).toBe('ganz Deutschland');
  });
});

describe('rebrandMessages', () => {
  it('ersetzt Marke und Domain, sonst nichts', () => {
    const out = rebrandMessages({ a: 'Auf LassTreffen.at und lasstreffen.at, in Wien.' }, SITES.AT, SITES.DE);
    expect(out).toEqual({ a: 'Auf LassTreffen.de und lasstreffen.de, in Wien.' });
  });
});
