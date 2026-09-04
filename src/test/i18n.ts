import deMessages from '../../messages/de.json';
import enMessages from '../../messages/en.json';

/**
 * Übersetzer für Tests reiner Funktionen, die ein `t` erwarten
 * (buildHubMeta, faqForGemeinde, …).
 *
 * Der globale next-intl-Mock in `src/test/setup.ts` deckt nur den
 * useTranslations-Hook ab. Pure Helper bekommen ihr `t` als Argument, und
 * genau dafür ist das hier: es löst gegen die ECHTEN Kataloge auf, sodass
 * die byte-identischen DE-Assertions in den Hub-Tests weiterhin beweisen,
 * dass die deutschen Seiten unverändert rendern — jetzt aber über
 * messages/de.json statt über inline Strings.
 *
 * Fehlende Keys geben `Namespace.key` zurück, wie next-intl im Fehlerfall:
 * ein Tippfehler fällt in der Assertion auf, statt still zu verschwinden.
 */
type MessageTree = { [key: string]: string | MessageTree };

const CATALOGUES: Record<string, MessageTree> = {
  de: deMessages as MessageTree,
  en: enMessages as MessageTree,
};

export function messageTranslator(locale: 'de' | 'en', namespace: string) {
  return (key: string, values?: Record<string, string | number>): string => {
    let node: string | MessageTree | undefined = CATALOGUES[locale];
    for (const part of `${namespace}.${key}`.split('.')) {
      if (typeof node !== 'object' || node === null) return `${namespace}.${key}`;
      node = node[part];
    }
    if (typeof node !== 'string') return `${namespace}.${key}`;
    if (!values) return node;
    return node.replace(/\{(\w+)\}/g, (m, name) =>
      name in values ? String(values[name]) : m,
    );
  };
}
