/**
 * Slug-/Shortid-/Duplicate-Resolver fuer /aktivitaet/[slug]
 * (fn-18 Task 3, Epic E5). Pur mit injiziertem Store — die Page bettet
 * nur ein; der echte Store laeuft server-seitig ueber den Service-Role-
 * Client (die public-RLS/View exponiert nur visible AND NOT is_closed,
 * der Resolver braucht aber auch unsichtbare Rows fuer 301/404).
 *
 * Resolver-Contract (Task-Spec, vollstaendig):
 *  - visible=true                                -> rendern (Slug-Drift -> 301
 *    auf den aktuellen Slug). Gilt AUCH fuer is_closed=true: dauerhaft
 *    geschlossene POIs bleiben als Seite erreichbar (kein 301->404), sind
 *    aber via Noindex-Gate (indexability.ts) immer noindex und tauchen
 *    weder in Sitemap noch /api/activities auf.
 *  - visible=false UND duplicate_of IS NOT NULL  -> 301 NUR wenn die
 *    Canonical-Row visible=true ist, sonst 404 (kein 301->404-Chaining,
 *    keine Wiederbelebung toter Gruppen — Task 2 leert duplicate_of beim
 *    Gruppen-Prune, wir pruefen trotzdem defensiv).
 *  - visible=false UND duplicate_of IS NULL      -> 404 (gepruned/stale).
 *  - Der Shortid-Fallback laeuft NUR ueber die dedizierte shortid-Spalte
 *    (UNIQUE-Index, Task 1 — keine Suffix-Scans auf slug) und loest
 *    geprunte Rows NIEMALS auf (gleiche Dispatch-Regeln wie oben).
 */

import { extractActivityShortId } from './slug';

/** Minimale Row-Sicht, die der Resolver braucht (Service-Role-Select). */
export interface ActivityResolverRow {
  id: string;
  slug: string;
  visible: boolean;
  is_closed: boolean;
  duplicate_of: string | null;
}

/** Injektionspunkt fuer die Page (Service-Role) bzw. Tests (Fakes). */
export interface ActivityResolverStore {
  getBySlug(slug: string): Promise<ActivityResolverRow | null>;
  getByShortId(shortid: string): Promise<ActivityResolverRow | null>;
  getById(id: string): Promise<ActivityResolverRow | null>;
}

export type ActivityResolution =
  | { outcome: 'render'; id: string }
  | { outcome: 'redirect'; slug: string }
  | { outcome: 'not-found' };

const RENDER = (id: string): ActivityResolution => ({ outcome: 'render', id });
const REDIRECT = (slug: string): ActivityResolution => ({ outcome: 'redirect', slug });
const NOT_FOUND: ActivityResolution = { outcome: 'not-found' };

/**
 * Loest einen (ggf. veralteten) Slug-Parameter auf: exakter Slug-Match,
 * sonst Shortid-Fallback -> 301 auf den aktuellen Slug (Epic E5);
 * duplicate_of-Rows -> 301 auf die lebende Canonical-Row, sonst 404.
 */
export async function resolveActivitySlug(
  slugParam: string,
  store: ActivityResolverStore,
): Promise<ActivityResolution> {
  if (!slugParam) return NOT_FOUND;

  let row = await store.getBySlug(slugParam);

  if (!row) {
    const shortid = extractActivityShortId(slugParam);
    if (!shortid) return NOT_FOUND;
    row = await store.getByShortId(shortid);
    if (!row) return NOT_FOUND;
  }

  // Sichtbare Row: rendern; alter/abweichender Slug -> 301 auf aktuell.
  if (row.visible) {
    return row.slug === slugParam ? RENDER(row.id) : REDIRECT(row.slug);
  }

  // Unsichtbares Fingerprint-Duplikat: 301 NUR auf lebende Canonicals.
  if (row.duplicate_of && row.duplicate_of !== row.id) {
    const canonical = await store.getById(row.duplicate_of);
    if (canonical && canonical.visible) {
      return REDIRECT(canonical.slug);
    }
    return NOT_FOUND;
  }

  // Gepruned/stale (visible=false, duplicate_of leer) oder defensiver
  // Selbst-Verweis -> 404. Gilt identisch fuer den Shortid-Fallback.
  return NOT_FOUND;
}
