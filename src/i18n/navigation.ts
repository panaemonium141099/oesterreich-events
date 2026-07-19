import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-bewusste Drop-in-Ersatzteile für next/navigation bzw. next/link.
 * `Link href="/map"` rendert auf DE-Seiten `/map`, auf EN-Seiten `/en/map`.
 * `usePathname()` liefert den Pfad OHNE Locale-Präfix — bestehende
 * Active-State-Logik (startsWith-Matching) funktioniert damit unverändert.
 *
 * Chrome-/Navigations-Komponenten sollen HIERVON importieren statt von
 * next/link bzw. next/navigation. Ausnahme: Komponenten, die den echten
 * URL-Pfad brauchen (z. B. PageviewTracker fürs Analytics), bleiben bei
 * next/navigation.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
