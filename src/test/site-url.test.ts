/**
 * publicOrigin — Links, die den Server verlassen, duerfen nie die interne
 * Bind-Adresse tragen. Genau das passierte nach dem Hetzner-Umzug: die
 * Bestaetigungsmail enthielt https://0.0.0.0:3000/api/event-reminder/confirm.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mk = (origin: string, headers: Record<string, string> = {}) => ({
  nextUrl: new URL(origin),
  headers: new Headers(headers),
});

describe('publicOrigin', () => {
  const ENV = process.env.NEXT_PUBLIC_SITE_URL;
  beforeEach(() => vi.resetModules());
  afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = ENV; });

  it('nimmt NEXT_PUBLIC_SITE_URL, auch wenn der Request auf 0.0.0.0 zeigt', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lasstreffen.at';
    const { publicOrigin } = await import('@/lib/site-url');
    expect(publicOrigin(mk('http://0.0.0.0:3000/x'))).toBe('https://lasstreffen.at');
  });

  it('schneidet einen abschliessenden Slash ab', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lasstreffen.at/';
    const { publicOrigin } = await import('@/lib/site-url');
    expect(publicOrigin(mk('http://0.0.0.0:3000/x'))).toBe('https://lasstreffen.at');
  });

  it('faellt ohne Env auf die Proxy-Header zurueck', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { publicOrigin } = await import('@/lib/site-url');
    expect(publicOrigin(mk('http://0.0.0.0:3000/x', {
      'x-forwarded-host': 'lasstreffen.at', 'x-forwarded-proto': 'https',
    }))).toBe('https://lasstreffen.at');
  });

  it('verwirft eine Bind-Adresse im Host-Header', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { publicOrigin } = await import('@/lib/site-url');
    // host = 0.0.0.0:3000 -> unbrauchbar, also nextUrl.origin als letzter Ausweg
    expect(publicOrigin(mk('http://localhost:3000/x', { host: '0.0.0.0:3000' })))
      .toBe('http://localhost:3000');
  });

  it('nutzt im lokalen Dev den Request-Origin', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { publicOrigin } = await import('@/lib/site-url');
    expect(publicOrigin(mk('http://localhost:3000/x'))).toBe('http://localhost:3000');
  });
});
