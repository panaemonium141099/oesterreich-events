/**
 * Themen der Seiten „Was kann man in X machen?" (/was-tun/[slug]/[thema]).
 *
 * Ein Thema ist EINE Zeile hier; daraus entsteht für jeden Ort (Bundesland,
 * Region, Gemeinde) von selbst eine Seite „Was kann man in X bei Regen
 * machen?". Neue Frage = neue Zeile, keine neue Route und keine Ortsliste.
 *
 * Ein Thema besteht nur aus Filtern, die /api/events und /api/activities
 * verstehen (`eventParams`, `activityParams`): der Server lädt die erste
 * Seite mit denselben Parametern, mit denen der Browser nachlädt. `null`
 * heißt: diese Art zeigt das Thema nicht.
 *
 * Welche Felder ein Thema tragen, ist gemessen (Prod 2026-11-20, Steiermark
 * 9.540 Events): `events.setting` ist nur bei 4 % gefüllt und taugt nicht,
 * `price_tier = 'gratis'` bei rund 6 %, Kategorie „Familie & Kinder" 549.
 * Aktivitäten tragen `setting` fast vollständig (indoor 1.441, outdoor
 * 3.482 von 11.612), aber kein Familien-Kennzeichen. Deshalb sagt jede
 * Seite in `note`, woran sie ihre Auswahl festmacht.
 */

import { addViennaDays, viennaToday, viennaWeekday } from '@/lib/utils/event-time';

export interface WasTunTheme {
  /** URL-Segment nach dem Ort. */
  slug: string;
  /** Kurzname für Chips und Brotkrumen: „Bei Regen". */
  label: string;
  /** Einschub in der Frage: „Was kann man in Lofer <phrase> machen?" */
  phrase: string;
  /** Filter der Events als Parameter von /api/events; null = keine Events. */
  eventParams: ((today: string) => Record<string, string>) | null;
  /** Filter der Aktivitäten als Parameter von /api/activities; null = keine. */
  activityParams: Record<string, string> | null;
  /** Ein Satz, woran die Seite ihre Auswahl festmacht. */
  note: string;
}

/** Samstag und Sonntag des kommenden (oder laufenden) Wochenendes. */
function weekendRange(today: string): { dateFrom: string; dateTo: string } {
  const day = viennaWeekday(today); // 0 So, 6 Sa
  const sat = addViennaDays(today, day === 6 ? 0 : day === 0 ? -1 : 6 - day);
  return { dateFrom: sat, dateTo: addViennaDays(sat, 1) };
}

export const WAS_TUN_THEMES: readonly WasTunTheme[] = [
  {
    slug: 'heute',
    label: 'Heute',
    phrase: 'heute',
    eventParams: (today) => ({ dateFrom: today, dateTo: today }),
    activityParams: {},
    note: 'Gezeigt werden die Veranstaltungen von heute und alle Ausflugsziele, die es dauerhaft gibt.',
  },
  {
    slug: 'am-wochenende',
    label: 'Am Wochenende',
    phrase: 'am Wochenende',
    eventParams: (today) => weekendRange(today),
    activityParams: {},
    note: 'Gezeigt werden die Veranstaltungen von Samstag und Sonntag und alle Ausflugsziele, die es dauerhaft gibt.',
  },
  {
    slug: 'bei-regen',
    label: 'Bei Regen',
    phrase: 'bei Regen',
    eventParams: () => ({ categories: 'Kultur & Bühne' }),
    activityParams: { setting: 'indoor' },
    note: 'Gezeigt werden Ausflugsziele, die drinnen liegen, und Veranstaltungen aus Kultur und Bühne.',
  },
  {
    slug: 'draussen',
    label: 'Draußen',
    phrase: 'draußen',
    eventParams: () => ({ categories: 'Natur & Abenteuer,Sport & Bewegung' }),
    activityParams: { setting: 'outdoor' },
    note: 'Gezeigt werden Ausflugsziele im Freien und Veranstaltungen aus Natur, Abenteuer, Sport und Bewegung.',
  },
  {
    slug: 'mit-kindern',
    label: 'Mit Kindern',
    phrase: 'mit Kindern',
    eventParams: () => ({ categories: 'Familie & Kinder' }),
    activityParams: null,
    note: 'Gezeigt werden Veranstaltungen der Kategorie Familie und Kinder.',
  },
  {
    slug: 'kostenlos',
    label: 'Kostenlos',
    phrase: 'kostenlos',
    eventParams: () => ({ priceTier: 'gratis' }),
    activityParams: null,
    note: 'Gezeigt werden Veranstaltungen, die ihre Quelle als gratis ausweist.',
  },
];

const BY_SLUG = new Map(WAS_TUN_THEMES.map((t) => [t.slug, t]));

export function wasTunThemeBySlug(slug: string): WasTunTheme | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Die Filter eines Themas für einen Wiener Tag; ohne Thema keine Filter. */
export function themeFilters(theme: WasTunTheme | null, today: string = viennaToday()): {
  events: Record<string, string> | null;
  activities: Record<string, string> | null;
} {
  if (!theme) return { events: {}, activities: {} };
  return {
    events: theme.eventParams ? theme.eventParams(today) : null,
    activities: theme.activityParams,
  };
}
