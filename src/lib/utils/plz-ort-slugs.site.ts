/**
 * Die PLZ-Ort-Tabelle der Seite für das Event-URL-Präfix (fn-31.10).
 *
 * Diese Datei ist die Tabelle von lasstreffen.at. Der Build von
 * lasstreffen.de leitet den Import auf `plz-ort-slugs.site.de.ts` um
 * (next.config.ts `turbopack.resolveAlias`, vitest.config.ts), damit keine
 * Seite die Tabelle der anderen im Client-Bundle trägt (DE: rund 120 KB).
 * Importiert wird sie nur als `@/lib/utils/plz-ort-slugs.site`.
 */
export { PLZ_ORT_SLUGS as SITE_PLZ_ORT_SLUGS } from './plz-ort-slugs.generated';
