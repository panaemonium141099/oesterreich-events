import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { V4EntdeckenSmartMode } from '@/components/Discover/v4/V4EntdeckenSmartMode';
import { markSmartAutorun } from '@/lib/search/smart-autorun';

/**
 * Smart-Tab als Freitext-Suche mit visueller Antwort (Variante A,
 * 2026-10-23). Vertrag: Textfeld → POST /api/search/semantic →
 * Verstanden-Chips + Concierge-Satz + Regale → + in den Plan →
 * POST /api/plans mit NUR den ausgewählten Events.
 */

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

const EVENT = {
  id: 'ev-1',
  title: 'Konzert im Stadtpark',
  start_date: '2026-08-01T17:30:00.000Z',
  end_date: null,
  location_name: 'Stadtpark',
  postal_code: '1010',
  address: 'Parkring 1, 1010 Wien',
  district: '1. innere stadt',
  bundesland: 'wien',
  category: 'Musik',
  image_url: null,
  price_text: 'Eintritt frei',
  price_tier: 'gratis',
  slug: 'konzert-im-stadtpark',
};

const EVENT_LATE = {
  ...EVENT,
  id: 'ev-2',
  title: 'Clubnacht',
  start_date: '2026-08-01T21:00:00.000Z',
  location_name: 'Flex',
  price_text: null,
  price_tier: null,
  slug: 'clubnacht',
  series_count: 3,
  series_dates: ['2026-08-08T21:00:00.000Z', '2026-08-15T21:00:00.000Z'],
};

const ACTIVITY = {
  id: 'poi-1',
  slug: 'therme-nova-abc123',
  name: 'Therme Nova',
  description_short: null,
  tags: [],
  setting: 'indoor',
  town: 'Köflach',
  gemeinde_slug: null,
  bundesland: 'steiermark',
  images: null,
  price_hint: null,
  online_bookable: false,
  distance_km: 12.4,
  _similarity: 0.5,
};

function semanticResponse(overrides: Partial<{ matches: unknown[]; activityMatches: unknown[]; signals: string[]; unmatched: string[]; max_price_tier: string | null }> = {}) {
  const matches = overrides.matches ?? [EVENT, EVENT_LATE];
  const activityMatches = overrides.activityMatches ?? [ACTIVITY];
  return {
    ok: true,
    status: 200,
    json: async () => ({
      query: 'konzerte in wien',
      parsed: {
        embedded_text: 'konzerte',
        after_date: null,
        before_date: null,
        max_price_tier: overrides.max_price_tier ?? null,
        signals: overrides.signals ?? ['location:bundesland:wien', 'intent:ai', 'category:Musik'],
        location_district: null,
        location_bundesland: 'wien',
        content_types: ['event'],
        unmatched_terms: overrides.unmatched ?? [],
      },
      matches,
      count: matches.length,
      activityMatches,
    }),
  };
}

function routeFetch(overrides?: { semantic?: () => unknown; plans?: () => unknown }) {
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes('/api/analytics')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/search/semantic')) return overrides?.semantic ? overrides.semantic() : semanticResponse();
    if (u.includes('/api/plans')) {
      return overrides?.plans
        ? overrides.plans()
        : { ok: true, status: 201, json: async () => ({ plan: { id: 'plan-1' } }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

function searchCalls() {
  return fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/search/semantic'));
}

function submit(text: string) {
  const input = screen.getByLabelText(/was hast du vor/i);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest('form')!);
}

describe('V4EntdeckenSmartMode (Freitext + Regale, Variante A)', () => {
  beforeEach(() => { fetchMock.mockReset(); routeFetch(); window.sessionStorage.clear(); });

  it('rendert Textfeld, Beispielsätze und keinen Chat', () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    expect(screen.getByLabelText(/was hast du vor/i)).toBeInTheDocument();
    expect(screen.getByText(/zum beispiel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /student und will heute abend/i })).toBeInTheDocument();
    expect(screen.queryByText(/concierge/i)).not.toBeInTheDocument();
  });

  it('Anfrage → POST /api/search/semantic, Antwort als Verstanden-Chips, Satz und Karten', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('konzerte in wien');

    await waitFor(() => expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument());
    const body = JSON.parse(String(searchCalls()[0][1]?.body ?? '{}'));
    expect(body.query).toBe('konzerte in wien');

    expect(screen.getByText('Verstanden')).toBeInTheDocument();
    expect(screen.getByText('Wien')).toBeInTheDocument();
    expect(screen.getAllByText('Musik').length).toBeGreaterThan(0);
    expect(screen.getByText(/2 Treffer und 1 Ausflugsziel für Wien · Musik/)).toBeInTheDocument();

    // Karten verlinken auf Detailseiten; Serien zeigen die übrigen Termine.
    expect(screen.getByRole('link', { name: /konzert im stadtpark/i })).toHaveAttribute('href', expect.stringContaining('/events/'));
    expect(screen.getByRole('link', { name: /therme nova/i })).toHaveAttribute('href', '/aktivitaet/therme-nova-abc123');
    expect(screen.getByText('+2 Termine')).toBeInTheDocument();
    expect(screen.getByText('Gratis')).toBeInTheDocument();
  });

  it('ein Tag → Regale nach Tagesphase, Ausflugsziele eigenes Regal', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('heute abend');
    await waitFor(() => expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument());
    // 17:30Z = 19:30 Wien (Abend), 21:00Z = 23:00 Wien (Nacht)
    expect(screen.getByRole('heading', { name: 'Abend' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nacht' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ausflugsziele' })).toBeInTheDocument();
  });

  it('Beispielsatz startet die Suche mit genau diesem Text', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    fireEvent.click(screen.getByRole('button', { name: /student und will heute abend/i }));
    await waitFor(() => expect(searchCalls().length).toBe(1));
    expect(JSON.parse(String(searchCalls()[0][1]?.body)).query).toBe('Bin Student und will heute abend billig saufen gehen');
  });

  it('Nachfrage-Chip hängt an die Anfrage an und sucht neu', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('konzerte in wien');
    await waitFor(() => expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Nur gratis' }));
    await waitFor(() => expect(searchCalls().length).toBe(2));
    expect(JSON.parse(String(searchCalls()[1][1]?.body)).query).toBe('konzerte in wien gratis');
  });

  it('initialQuery startet automatisch, wenn der Deep-Link in der App angeklickt wurde; Änderung startet neu', async () => {
    markSmartAutorun('preset');
    const { rerender } = render(<V4EntdeckenSmartMode initialQuery="preset"/>);
    await waitFor(() => expect(searchCalls().length).toBeGreaterThan(0));
    expect(JSON.parse(String(searchCalls()[0][1]?.body)).query).toBe('preset');

    markSmartAutorun('wiesmath');
    rerender(<V4EntdeckenSmartMode initialQuery="wiesmath"/>);
    await waitFor(() => {
      const last = JSON.parse(String(searchCalls().at(-1)?.[1]?.body ?? '{}'));
      expect(last.query).toBe('wiesmath');
    });
  });

  it('direkt aufgerufener Deep-Link (Lesezeichen, Crawler): nur vorbefüllt, keine Anfrage', async () => {
    render(<V4EntdeckenSmartMode initialQuery="Was kann man in Vils unternehmen?"/>);
    const input = screen.getByLabelText(/was hast du vor/i) as HTMLTextAreaElement;
    await waitFor(() => expect(input.value).toBe('Was kann man in Vils unternehmen?'));
    await new Promise(r => setTimeout(r, 50));
    expect(searchCalls().length).toBe(0);

    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(searchCalls().length).toBe(1));
  });

  it('ein Vermerk gilt nur für genau diese Query und nur einmal', async () => {
    markSmartAutorun('andere query');
    render(<V4EntdeckenSmartMode initialQuery="preset"/>);
    await new Promise(r => setTimeout(r, 50));
    expect(searchCalls().length).toBe(0);
    expect(window.sessionStorage.getItem('lt.smart.autorun')).toBeNull();
  });

  it('Plan: + auf Karten → Leiste, Speichern schickt NUR die ausgewählten Events, Aktivitäten als Notiz', async () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('plan für samstag');
    await waitFor(() => expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /konzert im stadtpark zum plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /therme nova zum plan/i }));
    expect(screen.getAllByText(/2 Stopps/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /als plan speichern/i })[0]);
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /plan gespeichert/i })[0]).toHaveAttribute('href', '/plan/plan-1');
    });
    const planCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/plans'));
    const planBody = JSON.parse(String(planCall![1]?.body ?? '{}'));
    expect(planBody.event_ids).toEqual(['ev-1']);
    expect(planBody.plan_date).toBe('2026-08-01');
    expect(planBody.name).toContain('plan für samstag');
    expect(planBody.note).toContain('Therme Nova');
    expect(planBody.note).toContain('/aktivitaet/therme-nova-abc123');
  });

  it('401 beim Speichern zeigt den Anmelde-Hinweis', async () => {
    routeFetch({ plans: () => ({ ok: false, status: 401, json: async () => ({}) }) });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('konzerte');
    await waitFor(() => expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /konzert im stadtpark zum plan/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /als plan speichern/i })[0]);
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /zum speichern bitte anmelden/i })[0]).toHaveAttribute('href', '/auth/login');
    });
  });

  it('ehrliche Leere: nicht gefundener Begriff wird gesagt, Beifang bleibt sichtbar', async () => {
    routeFetch({ semantic: () => semanticResponse({ unmatched: ['Oldtimer'], signals: ['location:bundesland:niederoesterreich', 'intent:ai'] }) });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('oldtimer treffen niederösterreich');
    await waitFor(() => expect(screen.getByText(/Für „Oldtimer" habe ich nichts gefunden/)).toBeInTheDocument());
    expect(screen.getByText('Konzert im Stadtpark')).toBeInTheDocument();
  });

  it('gar nichts gefunden: ehrlicher Satz, keine Regale', async () => {
    routeFetch({ semantic: () => semanticResponse({ matches: [], activityMatches: [], signals: ['today'] }) });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('irgendwas heute');
    await waitFor(() => expect(screen.getByText(/^Nichts gefunden für Heute/)).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Abend' })).not.toBeInTheDocument();
  });

  it('Fallback ohne KI wird im Satz benannt', async () => {
    routeFetch({ semantic: () => semanticResponse({ signals: ['intent:fallback'] }) });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('konzerte');
    await waitFor(() => expect(screen.getByText(/KI-Deutung war gerade nicht erreichbar/)).toBeInTheDocument());
  });

  it('API-Fehler rendert eine Fehlermeldung statt leerer Seite', async () => {
    routeFetch({ semantic: () => ({ ok: false, status: 503, json: async () => ({ error: 'search unavailable' }) }) });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    submit('konzerte');
    await waitFor(() => expect(screen.getByText(/gerade nicht erreichbar/i)).toBeInTheDocument());
  });
});
