import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notifyOperator, operatorEmail } from '../../lib/notify-operator';

const BREVO = 'https://api.brevo.com/v3/smtp/email';
const RESEND = 'https://api.resend.com/emails';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const mail = { context: 'inserat:abc', subject: 'Neues Inserat: Test', html: '<p>x</p>' };

describe('notifyOperator', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('BREVO_API_KEY', 'brevo-key');
    vi.stubEnv('RESEND_API_KEY', 'resend-key');
    vi.stubEnv('BUSINESS_LEADS_EMAIL', '');
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('schickt an office@, solange BUSINESS_LEADS_EMAIL nicht gesetzt ist', async () => {
    fetchMock.mockResolvedValueOnce(json(201, { messageId: 'm1' }));
    expect(operatorEmail()).toBe('office@lasstreffen.at');
    expect(await notifyOperator(mail)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BREVO);
    expect(JSON.parse(init.body).to).toEqual([{ email: 'office@lasstreffen.at' }]);
  });

  it('BUSINESS_LEADS_EMAIL überschreibt den Empfänger', () => {
    vi.stubEnv('BUSINESS_LEADS_EMAIL', 'chef@example.com');
    expect(operatorEmail()).toBe('chef@example.com');
  });

  it('weicht auf Resend aus, wenn Brevo ablehnt (z. B. Tageskontingent)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(403, { message: 'daily quota exceeded' }))
      .mockResolvedValueOnce(json(200, { id: 'r1' }));
    expect(await notifyOperator(mail)).toBe(true);
    expect(fetchMock.mock.calls.map((c: unknown[]) => c[0])).toEqual([BREVO, RESEND]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('meldet false und loggt Anlass und Grund, wenn beide Wege scheitern', async () => {
    fetchMock
      .mockResolvedValueOnce(json(403, { message: 'daily quota exceeded' }))
      .mockResolvedValueOnce(json(422, { message: 'domain not verified' }));
    expect(await notifyOperator(mail)).toBe(false);
    const logged = errorSpy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n');
    expect(logged).toContain('inserat:abc');
    expect(logged).toContain('daily quota exceeded');
    expect(logged).toContain('domain not verified');
  });

  it('meldet false statt still Erfolg, wenn kein Anbieter konfiguriert ist', async () => {
    vi.stubEnv('BREVO_API_KEY', '');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(await notifyOperator(mail)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('wirft nie, auch wenn fetch selbst wirft', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(notifyOperator(mail)).resolves.toBe(false);
  }, 15_000);
});
