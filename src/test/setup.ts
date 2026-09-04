import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';
import deMessages from '../../messages/de.json';

/**
 * fn-17 i18n: Komponenten-Tests rendern ohne NextIntlClientProvider.
 * Wir mocken next-intl global mit den ECHTEN deutschen Messages, damit
 * bestehende Assertions auf deutsche UI-Strings ("Karte", "Anmelden", …)
 * unverändert weiter greifen. `t('key')` löst gegen messages/de.json auf;
 * fehlende Keys fallen auf "Namespace.key" zurück (so verhält sich
 * next-intl im Fehlerfall ebenfalls sichtbar statt still).
 */
type MessageTree = { [key: string]: string | MessageTree };

function resolveMessage(namespace: string | undefined, key: string): string {
  const path = namespace ? `${namespace}.${key}` : key;
  let node: string | MessageTree | undefined = deMessages as MessageTree;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return path;
    node = node[part];
  }
  return typeof node === 'string' ? node : path;
}

function interpolate(msg: string, values?: Record<string, unknown>): string {
  if (!values) return msg;
  return msg.replace(/\{(\w+)\}/g, (m, name) =>
    name in values ? String(values[name]) : m,
  );
}

vi.mock('next-intl', () => {
  const makeT = (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      interpolate(resolveMessage(namespace, key), values);
    t.rich = t;
    t.markup = t;
    t.raw = (key: string) => resolveMessage(namespace, key);
    t.has = (key: string) => resolveMessage(namespace, key) !== (namespace ? `${namespace}.${key}` : key);
    return t;
  };
  return {
    useTranslations: (namespace?: string) => makeT(namespace),
    useLocale: () => 'de',
    useMessages: () => deMessages,
    useFormatter: () => ({
      dateTime: (d: Date) => d.toISOString(),
      number: (n: number) => String(n),
      relativeTime: () => '',
      list: (items: Iterable<string>) => Array.from(items).join(', '),
    }),
    hasLocale: (locales: readonly string[], candidate: unknown) =>
      typeof candidate === 'string' && (locales as readonly string[]).includes(candidate),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

/**
 * Server-Pendant: `getTranslations`/`setRequestLocale` aus
 * next-intl/server. Ohne diesen Mock wirft jede Server-Komponente im Test
 * "`getTranslations` is not supported in Client Components" — die
 * Seiten-Tests der SEO-Hubs rendern aber genau solche Komponenten.
 * Aufloesung wieder gegen die echten DE-Messages, damit bestehende
 * Assertions auf deutsche Strings unveraendert greifen.
 */
vi.mock('next-intl/server', () => {
  const makeT = (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      interpolate(resolveMessage(namespace, key), values);
    t.rich = t;
    t.markup = t;
    t.raw = (key: string) => resolveMessage(namespace, key);
    t.has = (key: string) => resolveMessage(namespace, key) !== (namespace ? `${namespace}.${key}` : key);
    return t;
  };
  return {
    getTranslations: async (opts?: { namespace?: string } | string) =>
      makeT(typeof opts === 'string' ? opts : opts?.namespace),
    getLocale: async () => 'de',
    getMessages: async () => deMessages,
    getFormatter: async () => ({
      dateTime: (d: Date) => d.toISOString(),
      number: (n: number) => String(n),
      relativeTime: () => '',
      list: (items: Iterable<string>) => Array.from(items).join(', '),
    }),
    setRequestLocale: () => {},
  };
});

/**
 * @/i18n/navigation delegiert im Test auf next/link bzw. next/navigation —
 * per-Test-Mocks von next/navigation (useRouter/usePathname) greifen damit
 * genau wie vor der i18n-Einführung.
 */
vi.mock('@/i18n/navigation', async () => {
  const nextLink = await import('next/link');
  const nextNavigation = await import('next/navigation');
  return {
    Link: nextLink.default,
    usePathname: () => nextNavigation.usePathname(),
    useRouter: () => nextNavigation.useRouter(),
    redirect: (href: unknown) => nextNavigation.redirect(String(href)),
    getPathname: ({ href }: { href: string }) => href,
  };
});
