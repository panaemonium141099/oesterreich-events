import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { V4EntdeckenSmartMode } from '@/components/Discover/v4/V4EntdeckenSmartMode';

/**
 * fn-19 Rework: Der Smart-Tab ist EIN durchgehender Concierge-Chat
 * (V4SmartChat). Diese Tests decken den Chat-Vertrag ab:
 * POST /api/search/chat (SSE) → Text + Entity-Karten → Timeline-Auswahl
 * → POST /api/plans mit NUR den ausgewählten Events.
 */

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function sseResponse(frames: Array<[string, unknown]>) {
  const payload = frames
    .map(([ev, data]) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(payload));
        c.close();
      },
    }),
  };
}

const EVENT_CARD = {
  kind: 'event',
  id: 'ev-1',
  title: 'Konzert im Stadtpark',
  start_date: '2026-08-01T19:30:00.000Z',
  location_name: 'Stadtpark',
  bundesland: 'wien',
  category: 'Musik',
  image_url: null,
  price_text: null,
  slug: 'konzert-im-stadtpark',
  postal_code: '1010',
  address: 'Parkring 1, 1010 Wien',
};

const ACTIVITY_CARD = {
  kind: 'activity',
  id: 'poi-1',
  slug: 'therme-nova-abc123',
  name: 'Therme Nova',
  town: 'Köflach',
  bundesland: 'steiermark',
  setting: 'indoor',
  price_hint: null,
  image_url: null,
};

/** Default-Routing: Analytics schluckt, Chat liefert Text + 2 Karten. */
function routeFetch(overrides?: {
  chat?: () => unknown;
  plans?: () => unknown;
}) {
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes('/api/analytics')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/search/chat')) {
      return overrides?.chat
        ? overrides.chat()
        : sseResponse([
            ['text', { delta: 'Servus! Wie wär es damit:' }],
            ['entity', { kind: 'event', card: EVENT_CARD }],
            ['entity', { kind: 'activity', card: ACTIVITY_CARD }],
            ['done', {}],
          ]);
    }
    if (u.includes('/api/plans')) {
      return overrides?.plans
        ? overrides.plans()
        : { ok: true, status: 201, json: async () => ({ plan: { id: 'plan-1' } }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

function chatCalls() {
  return fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/search/chat'));
}

async function submitMessage(text: string) {
  const input = screen.getByPlaceholderText(/was hast du vor/i);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest('form')!);
}

describe('V4EntdeckenSmartMode (Chat-Rework fn-19)', () => {
  beforeEach(() => { fetchMock.mockReset(); routeFetch(); });

  it('rendert Composer + Starter-Chips', () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    expect(screen.getByPlaceholderText(/was hast du vor/i)).toBeInTheDocument();
    expect(screen.getByText(/probier mal/i)).toBeInTheDocument();
  });

  it('Nachricht → POST /api/search/chat, Antwort mit Text + Entity-Karten', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    await submitMessage('konzerte in wien');

    await waitFor(() => {
      expect(screen.getByText(/wie wär es damit/i)).toBeInTheDocument();
    });
    const body = JSON.parse(String(chatCalls()[0][1]?.body ?? '{}'));
    expect(body.messages).toEqual([{ role: 'user', content: 'konzerte in wien' }]);

    expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument();
    expect(screen.getByText('Therme Nova')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /therme nova/i }))
      .toHaveAttribute('href', '/aktivitaet/therme-nova-abc123');
  });

  it('initialQuery startet den Chat automatisch; Änderung startet neu', async () => {
    const { rerender } = render(<V4EntdeckenSmartMode initialQuery="preset"/>);
    await waitFor(() => expect(chatCalls().length).toBeGreaterThan(0));
    expect(JSON.parse(String(chatCalls()[0][1]?.body ?? '{}')).messages[0].content).toBe('preset');

    rerender(<V4EntdeckenSmartMode initialQuery="wiesmath"/>);
    await waitFor(() => {
      const last = JSON.parse(String(chatCalls().at(-1)?.[1]?.body ?? '{}'));
      expect(last.messages[0].content).toBe('wiesmath');
    });
  });

  it('Follow-up schickt den Verlauf mit', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    await submitMessage('konzerte in wien');
    await waitFor(() => expect(screen.getByText(/wie wär es damit/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Eher indoor' }));
    await waitFor(() => expect(chatCalls().length).toBe(2));
    const body = JSON.parse(String(chatCalls()[1][1]?.body ?? '{}'));
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(body.messages.at(-1).content).toBe('Eher indoor');
  });

  it('Timeline: einzelne Karten auswählen → Plan speichert NUR die Auswahl', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    await submitMessage('plan für samstag');
    await waitFor(() => expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument());

    // Nur das Event auswählen, die Aktivität NICHT.
    fireEvent.click(screen.getByRole('button', { name: /konzert im stadtpark zur timeline/i }));
    expect(screen.getByText(/deine timeline \(1\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /timeline als plan speichern/i }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /plan gespeichert/i }))
        .toHaveAttribute('href', '/plan/plan-1');
    });
    const planCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/plans'));
    const planBody = JSON.parse(String(planCall![1]?.body ?? '{}'));
    expect(planBody.event_ids).toEqual(['ev-1']);
    expect(planBody.plan_date).toBe('2026-08-01');
    expect(planBody.name).toContain('plan für samstag');
    expect(planBody.note).toBeNull();
  });

  it('ausgewählte Aktivitäten wandern als Notiz-Zeilen in den Plan', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    await submitMessage('tagesplan');
    await waitFor(() => expect(screen.getByText('Therme Nova')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /konzert im stadtpark zur timeline/i }));
    fireEvent.click(screen.getByRole('button', { name: /therme nova zur timeline/i }));
    fireEvent.click(screen.getByRole('button', { name: /timeline als plan speichern/i }));

    await waitFor(() => expect(screen.getByRole('link', { name: /plan gespeichert/i })).toBeInTheDocument());
    const planBody = JSON.parse(String(
      fetchMock.mock.calls.find(c => String(c[0]).includes('/api/plans'))![1]?.body ?? '{}',
    ));
    expect(planBody.note).toContain('Therme Nova');
    expect(planBody.note).toContain('/aktivitaet/therme-nova-abc123');
  });

  it('401 beim Speichern zeigt den Anmelde-Hinweis', async () => {
    routeFetch({ plans: () => ({ ok: false, status: 401, json: async () => ({}) }) });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    await submitMessage('konzerte');
    await waitFor(() => expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /konzert im stadtpark zur timeline/i }));
    fireEvent.click(screen.getByRole('button', { name: /timeline als plan speichern/i }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /zum speichern bitte anmelden/i }))
        .toHaveAttribute('href', '/auth/login');
    });
  });

  it('error-Frame rendert als Concierge-Fehlermeldung', async () => {
    routeFetch({ chat: () => sseResponse([['error', { message: 'Concierge-Chat derzeit nicht verfügbar.' }]]) });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    await submitMessage('konzerte');
    await waitFor(() => {
      expect(screen.getByText(/derzeit nicht verfügbar/i)).toBeInTheDocument();
    });
  });
});
