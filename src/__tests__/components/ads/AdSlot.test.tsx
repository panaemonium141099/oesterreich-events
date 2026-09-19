import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

/**
 * AdSlot fordert Anzeigen nur fuer Menschen an (2026-09-19): erst nach einer
 * echten Nutzergeste, nie unter Automation. Vorher machte ein 4-s-Fallback
 * jede Seitenladung eines Headless-Crawlers zur AdSense-Impression.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Die Account-Freigabe (werbefreie Accounts) hat eigene Tests in
// lib/ads/ads-allowed.test.ts — hier ist der Besucher immer freigegeben.
vi.mock('@/lib/ads/ads-allowed', () => ({ useAdsAllowed: () => true }));

let intersect: () => void = () => {};

async function loadAdSlot() {
  // Die Env-Schalter werden beim Modul-Load in Konstanten gelesen.
  vi.resetModules();
  const mod = await import('@/components/Ads/AdSlot');
  return mod.AdSlot;
}

function adRequests() {
  return window.adsbygoogle?.length ?? 0;
}

describe('AdSlot — Anzeigen nur nach Nutzergeste', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ADS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT_ID', 'ca-pub-test');
    window.adsbygoogle = [];
    class FakeObserver {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        intersect = () => cb([{ isIntersecting: true }]);
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reine Seitenladung: keine Anfrage, auch nicht nach Sichtbarkeit und Wartezeit', async () => {
    vi.useFakeTimers();
    const AdSlot = await loadAdSlot();
    const { container } = render(<AdSlot slot="123" />);

    act(() => intersect());
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
    expect(adRequests()).toBe(0);
  });

  it('programmatisches Scrollen zaehlt nicht als Geste', async () => {
    const AdSlot = await loadAdSlot();
    const { container } = render(<AdSlot slot="123" />);

    fireEvent.scroll(window);
    act(() => intersect());

    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
    expect(adRequests()).toBe(0);
  });

  it('Nutzergeste + Sichtbarkeit: Anzeige wird genau einmal angefordert', async () => {
    const AdSlot = await loadAdSlot();
    const { container } = render(<AdSlot slot="123" />);

    fireEvent.wheel(window);
    act(() => intersect());

    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins).toHaveAttribute('data-ad-slot', '123');
    expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-test');
    expect(adRequests()).toBe(1);
  });

  it('Fallback-Timer laeuft erst ab der Geste', async () => {
    vi.useFakeTimers();
    const AdSlot = await loadAdSlot();
    const { container } = render(<AdSlot slot="123" />);

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(adRequests()).toBe(0);

    fireEvent.pointerMove(window);
    act(() => { vi.advanceTimersByTime(4_000); });

    expect(container.querySelector('ins.adsbygoogle')).not.toBeNull();
    expect(adRequests()).toBe(1);
  });

  it('unter Automation (navigator.webdriver) nie', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    const AdSlot = await loadAdSlot();
    const { container } = render(<AdSlot slot="123" />);

    fireEvent.wheel(window);
    fireEvent.pointerDown(window);
    act(() => intersect());

    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
    expect(adRequests()).toBe(0);
  });

  it('ohne Schalter rendert der Slot gar nichts', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADS_ENABLED', 'false');
    const AdSlot = await loadAdSlot();
    const { container } = render(<AdSlot slot="123" />);
    expect(container.innerHTML).toBe('');
  });
});
