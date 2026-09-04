'use client';

/**
 * V4LocaleSwitcher — Sprachwahl-Dropdown im TopNav (fn-17).
 *
 * Natives <select> im v4-Pill-Look: barrierefrei out of the box und
 * skaliert auf Sprache 3+ ohne UI-Umbau (neuer Eintrag in
 * routing.locales + messages/<lang>.json genügt).
 *
 * Der Wechsel bleibt auf der AKTUELLEN Seite (Best Practice: gleiche
 * Seite, andere Sprache): usePathname() aus @/i18n/navigation liefert
 * den Pfad ohne Locale-Präfix, router.replace(..., { locale }) hängt
 * das Ziel-Präfix an. Query-String wird zur Laufzeit aus
 * window.location übernommen (KEIN useSearchParams — das würde die
 * statisch gerenderten Seiten in einen CSR-Bailout zwingen).
 */

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

const LOCALE_SHORT: Record<AppLocale, string> = {
  de: 'DE',
  en: 'EN',
};

export function V4LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function onChange(next: string) {
    if (next === locale) return;
    const search = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`${pathname}${search}`, { locale: next as AppLocale });
  }

  return (
    <label
      className="press-haptic relative inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[var(--v4-hairline-2)] text-[12px] font-semibold text-[var(--v4-ink-50)] hover:text-[var(--v4-ink-70)] hover:border-[var(--v4-hairline-3)] transition-colors cursor-pointer"
      data-locale-switcher
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span aria-hidden="true">{LOCALE_SHORT[locale as AppLocale] ?? locale.toUpperCase()}</span>
      {/*
        Das native Dropdown-Popup wird vom Browser gezeichnet und ignoriert
        das opacity-0 der Pille — es erbt aber `color` und `background-color`
        vom <select>. Ohne eigene Werte waren das
        `rgba(255,255,255,0.5)` (geerbtes --v4-ink-50 vom <label>) auf
        `transparent` (Tailwind-Preflight setzt Form-Controls transparent).
        Ergebnis: weiße Schrift auf dem weißen Default-Popup, unlesbar.
        Deshalb hier explizit dunkler Grund + volles Weiß auf select UND
        option (Firefox/Safari lesen die Farbe von der <option>, Chrome
        vom <select>) plus color-scheme:dark für die Scrollbar/Rahmen.
      */}
      <select
        value={locale}
        onChange={e => onChange(e.target.value)}
        aria-label={t('label')}
        className="absolute inset-0 w-full opacity-0 cursor-pointer bg-[var(--v4-surface-elevated)] text-[var(--v4-ink)] [color-scheme:dark]"
      >
        {routing.locales.map(l => (
          <option
            key={l}
            value={l}
            className="bg-[var(--v4-surface-elevated)] text-[var(--v4-ink)]"
          >
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
