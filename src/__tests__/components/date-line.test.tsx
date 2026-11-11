/**
 * DateLine: Wiener Tag aus dem Server-HTML, Wetter heute in Wien nach dem
 * Laden ohne Layoutsprung, gerundete Event-Zahl; nach Mitternacht rechnet
 * die Insel den Tag neu und meldet ihn an die anderen Inseln.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const { loadTodayWeather } = vi.hoisted(() => ({ loadTodayWeather: vi.fn() }));
vi.mock('@/lib/landing/weekend-weather', () => ({
  RAIN_MM: 3,
  loadTodayWeather: () => loadTodayWeather(),
}));

import { DateLine, formatThousands, formatViennaDay, roundCountryTotal } from '@/components/Landing/v4/DateLine';
import {
  announceViennaDay,
  resetViennaDayForTests,
  useViennaDay,
  VIENNA_DAY_EVENT,
} from '@/lib/landing/vienna-day';

const never = () => new Promise<never>(() => {});

function Probe({ initial }: { initial: string }) {
  const day = useViennaDay(initial);
  return <span data-testid="probe">{day}</span>;
}

describe('roundCountryTotal', () => {
  it('rundet auf volle Tausender ab, unter 1.000 und ohne Wert keine Zahl', () => {
    expect(roundCountryTotal(88_431)).toBe(88_000);
    expect(roundCountryTotal(1_000)).toBe(1_000);
    expect(roundCountryTotal(999)).toBeNull();
    expect(roundCountryTotal(null)).toBeNull();
    expect(roundCountryTotal(Number.NaN)).toBeNull();
  });
});

describe('formatThousands', () => {
  it('setzt Tausenderpunkt (de) bzw. Komma (en)', () => {
    expect(formatThousands(88_000, 'de')).toBe('88.000');
    expect(formatThousands(1_234_000, 'de')).toBe('1.234.000');
    expect(formatThousands(88_000, 'en')).toBe('88,000');
    expect(formatThousands(900, 'de')).toBe('900');
  });
});

describe('formatViennaDay', () => {
  it('formatiert den Kalendertag unabhängig von der Runtime-Zone', () => {
    expect(formatViennaDay('2026-10-30', 'de')).toBe('Freitag, 30. Oktober');
    expect(formatViennaDay('2026-10-30', 'en')).toBe('Friday 30 October');
  });
});

describe('DateLine', () => {
  beforeEach(() => {
    loadTodayWeather.mockReset();
    loadTodayWeather.mockImplementation(never);
    resetViennaDayForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt Tag, reservierten Wetterplatz und die gerundete Zahl', async () => {
    let resolve!: (w: unknown) => void;
    loadTodayWeather.mockImplementation(() => new Promise(r => { resolve = r; }));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));

    render(<DateLine today="2026-10-30" countryTotal={88_431}/>);

    expect(screen.getByTestId('date-line-day')).toHaveTextContent('Freitag, 30. Oktober');
    const slot = screen.getByTestId('date-line-weather');
    expect(slot).toHaveTextContent('');
    expect(slot.className).toContain('min-w-');
    expect(screen.getByTestId('date-line-count')).toHaveTextContent('über 88.000 Events in Österreich');

    await act(async () => { resolve({ day: '2026-10-30', tempMax: 12, precipMm: 0 }); });
    expect(slot).toHaveTextContent('12° in Wien');
    expect(slot).toHaveTextContent('☀️');
  });

  it('ohne countryTotal keine Zahl, Regen zeigt das Regen-Symbol', async () => {
    loadTodayWeather.mockImplementation(() => Promise.resolve({ day: '2026-10-30', tempMax: 8, precipMm: 5 }));
    render(<DateLine today="2026-10-30" countryTotal={null}/>);
    expect(screen.queryByTestId('date-line-count')).toBeNull();
    await act(async () => {});
    expect(screen.getByTestId('date-line-weather')).toHaveTextContent('🌧');
    expect(screen.getByTestId('date-line-weather')).toHaveTextContent('8° in Wien');
  });

  it('korrigiert den Tag um Mitternacht (Wien) und meldet ihn', () => {
    vi.useFakeTimers();
    // 23:59:30 Wien am 30.10. (CET, UTC+1)
    vi.setSystemTime(new Date('2026-10-30T22:59:30Z'));
    const seen: string[] = [];
    const onDay = (e: Event) => seen.push((e as CustomEvent<{ day: string }>).detail.day);
    window.addEventListener(VIENNA_DAY_EVENT, onDay);

    render(<DateLine today="2026-10-30" countryTotal={null}/>);
    expect(screen.getByTestId('date-line-day')).toHaveTextContent('Freitag, 30. Oktober');
    expect(seen).toEqual(['2026-10-30']);

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId('date-line-day')).toHaveTextContent('Samstag, 31. Oktober');
    expect(seen.at(-1)).toBe('2026-10-31');
    window.removeEventListener(VIENNA_DAY_EVENT, onDay);
  });

  it('eine ältere Ausgabe zeigt nach dem Laden den heutigen Tag', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T08:00:00Z'));
    render(<DateLine today="2026-10-30" countryTotal={null}/>);
    expect(screen.getByTestId('date-line-day')).toHaveTextContent('Samstag, 31. Oktober');
  });
});

describe('useViennaDay', () => {
  beforeEach(() => resetViennaDayForTests());

  it('beginnt mit dem Server-Tag und folgt der Meldung', () => {
    render(<Probe initial="2026-10-30"/>);
    expect(screen.getByTestId('probe')).toHaveTextContent('2026-10-30');
    act(() => announceViennaDay('2026-10-31'));
    expect(screen.getByTestId('probe')).toHaveTextContent('2026-10-31');
  });

  it('ein später abonnierender Leser übernimmt den schon gemeldeten Tag', () => {
    announceViennaDay('2026-11-01');
    render(<Probe initial="2026-10-30"/>);
    expect(screen.getByTestId('probe')).toHaveTextContent('2026-11-01');
  });
});
