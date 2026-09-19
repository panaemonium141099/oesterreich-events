import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adsAllowedFromResponse,
  hasSupabaseAuthCookie,
  resetAdsAllowed,
  resolveAdsAllowed,
} from '@/lib/ads/ads-allowed';

function setCookie(value: string) {
  Object.defineProperty(document, 'cookie', { value, configurable: true });
}

describe('adsAllowedFromResponse', () => {
  it('erlaubt Anzeigen, wenn das Profil nicht werbefrei ist', () => {
    expect(adsAllowedFromResponse(200, { signedIn: true, adsDisabled: false })).toBe(true);
  });

  it('blockt werbefreie Accounts', () => {
    expect(adsAllowedFromResponse(200, { signedIn: true, adsDisabled: true })).toBe(false);
  });

  it('behandelt 401 als anonym (Cookie ohne gueltige Session)', () => {
    expect(adsAllowedFromResponse(401, null)).toBe(true);
  });

  it('legt Fehler zugunsten des Kontos aus: keine Anzeige', () => {
    expect(adsAllowedFromResponse(500, { error: 'x' })).toBe(false);
    expect(adsAllowedFromResponse(200, null)).toBe(false);
    expect(adsAllowedFromResponse(200, 'kaputt')).toBe(false);
  });
});

describe('resolveAdsAllowed', () => {
  afterEach(() => {
    resetAdsAllowed();
    vi.unstubAllGlobals();
    setCookie('');
  });

  it('erkennt den Supabase-Auth-Cookie wie die Middleware', () => {
    setCookie('theme=dark; sb-api-auth-token.0=abc');
    expect(hasSupabaseAuthCookie()).toBe(true);
    setCookie('theme=dark; sb-api-auth-token-code-verifier=xyz');
    expect(hasSupabaseAuthCookie()).toBe(true);
    setCookie('theme=dark');
    expect(hasSupabaseAuthCookie()).toBe(false);
  });

  it('feuert fuer anonyme Besucher keinen Request und erlaubt sofort', async () => {
    setCookie('theme=dark');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAdsAllowed()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fragt fuer eingeloggte Besucher einmal /api/me/ads und teilt die Antwort', async () => {
    setCookie('sb-api-auth-token=abc');
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ signedIn: true, adsDisabled: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = await Promise.all([resolveAdsAllowed(), resolveAdsAllowed()]);
    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me/ads');
  });

  it('entscheidet nach resetAdsAllowed neu', async () => {
    setCookie('sb-api-auth-token=abc');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, json: async () => ({ signedIn: true, adsDisabled: false }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ signedIn: true, adsDisabled: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAdsAllowed()).resolves.toBe(true);
    resetAdsAllowed();
    await expect(resolveAdsAllowed()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('blockt bei Netzwerkfehlern statt Anzeigen zu riskieren', async () => {
    setCookie('sb-api-auth-token=abc');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(resolveAdsAllowed()).resolves.toBe(false);
  });
});
