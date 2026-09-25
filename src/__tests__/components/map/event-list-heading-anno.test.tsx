import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/i18n/navigation', () => ({ Link: (p: { children: React.ReactNode }) => <a>{p.children}</a> }));
vi.mock('@/lib/v4/use-detail-hydration', () => ({ useDetailHydration: (e: unknown[]) => e }));

import { EventListView } from '@/components/MapV3/EventListView';

describe('EventListView-Überschrift', () => {
  it('aktualisiert die Zahl, auch wenn AdSense den Textknoten zerlegt hat', () => {
    const { container, rerender } = render(
      <EventListView events={[]} loading={false} scopeLabel="Österreich" />,
    );
    const h2 = container.querySelector('h2')!;
    expect(h2.textContent).toContain('0 Events · Österreich');

    // So baut Google „google-anno“ Links ein: Textknoten raus, Teile + <a> rein.
    const walker = document.createTreeWalker(h2, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node && !node.nodeValue?.includes('Events')) node = walker.nextNode();
    const parent = node!.parentNode!;
    const anno = document.createElement('a');
    anno.className = 'google-anno';
    anno.textContent = 'Events';
    parent.replaceChild(anno, node!);
    parent.insertBefore(document.createTextNode('0 '), anno);

    // Zählteil wechselt (wie 609 → 77 nach einem Filterwechsel).
    rerender(<EventListView events={[]} loading scopeLabel="Burgenland" />);
    const h = container.querySelector('h2')!.textContent!;
    expect(h).not.toContain('0 Events');
    expect(h).toContain('· Burgenland');
  });
});
