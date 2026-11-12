/**
 * Nachrichten je Sprache und Seite (fn-31).
 *
 * Basis ist `messages/<sprache>.json`. Eine Seite, die nicht lasstreffen.at
 * ist, legt ihre Überlagerung darüber (`messages/de.DE.json`): nur die
 * Schlüssel, deren Wortlaut das Land nennt. Danach wird in jedem Text der
 * Name der Seite ersetzt („LassTreffen.at“ → Marke der Seite).
 *
 * Für lasstreffen.at kommt die Basis unverändert zurück, dasselbe Objekt.
 */
import type { SiteConfig } from '@/lib/site/sites';
import { SITES } from '@/lib/site/sites';

export type Messages = { [key: string]: string | Messages };

/** Tiefe Zusammenführung: Werte der Überlagerung gewinnen, Zweige bleiben erhalten. */
export function mergeMessages(base: Messages, overlay: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = out[key];
    out[key] =
      typeof value === 'object' && typeof current === 'object' ? mergeMessages(current, value) : value;
  }
  return out;
}

/** Ersetzt in jedem Text Marke und Domain der Ausgangsseite durch die der Seite. */
export function rebrandMessages(messages: Messages, from: SiteConfig, to: SiteConfig): Messages {
  const swap = (text: string) => text.split(from.brand).join(to.brand).split(from.domain).join(to.domain);
  const walk = (node: Messages): Messages =>
    Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, typeof v === 'string' ? swap(v) : walk(v)]),
    );
  return walk(messages);
}

/** Schlüsselpfade der Überlagerung, die es in der Basis nicht gibt (für den Wächter). */
export function unknownOverlayKeys(base: Messages, overlay: Messages, prefix = ''): string[] {
  return Object.entries(overlay).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const current = base[key];
    if (current === undefined) return [path];
    if (typeof value === 'object') {
      return typeof current === 'object' ? unknownOverlayKeys(current, value, path) : [path];
    }
    return typeof current === 'string' ? [] : [path];
  });
}

/** Die Nachrichten einer Sprache für eine Seite, aus Basis und Überlagerung. */
export function messagesForSite(base: Messages, overlay: Messages | null, site: SiteConfig): Messages {
  if (site.country === 'AT') return base;
  const merged = overlay ? mergeMessages(base, overlay) : base;
  return rebrandMessages(merged, SITES.AT, site);
}

/** Lädt die Nachrichten der Sprache für die Seite dieses Builds. */
export async function loadMessages(locale: string, site: SiteConfig): Promise<Messages> {
  const base = (await import(`../../messages/${locale}.json`)).default as Messages;
  if (site.country === 'AT') return base;
  const overlay =
    locale === 'de' && site.country === 'DE'
      ? ((await import('../../messages/de.DE.json')).default as Messages)
      : null;
  return messagesForSite(base, overlay, site);
}
