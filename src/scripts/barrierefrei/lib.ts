/**
 * Gemeinsame Helfer der Barrierefrei-Quellen-Adapter
 * (src/scripts/barrierefrei/fetch-*.ts -> data/barrierefrei/<quelle>.json).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DatasetEntry, DatasetFile } from '@/lib/activities/barrierefrei-dataset';
import { validateDatasetFile } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';

export const USER_AGENT =
  'Mozilla/5.0 (compatible; lasstreffen.at/1.0; +https://lasstreffen.at/quellen) Barrierefrei-Verzeichnis';

export const DATA_DIR = join(process.cwd(), 'data', 'barrierefrei');

/** Heutiges Datum als YYYY-MM-DD (checked_at). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Seite laden; mit `maxBytes` wird der Body nach so vielen Bytes
 * abgebrochen (Detailseiten von niederoesterreich.at sind 5 MB, weil sie
 * eine komplette Karten-Datenbank einbetten — alles Wichtige steht in den
 * ersten 250 KB).
 */
export async function fetchText(url: string, maxBytes?: number): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  if (!maxBytes || !res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (received >= maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  }
  const all = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(all);
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

/** Whitespace/NBSP normalisieren. */
export function clean(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

/** "© Foo" / "(c) Foo" -> "Foo" (das Credit-Praefix setzt die Anzeige). */
export function stripCopyrightPrefix(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/^(?:©|\(c\)|copyright:?)\s*/gi, '').replace(/^(?:©|\(c\))\s*/i, '').trim();
  return t === '' ? null : t;
}

export function slugId(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Merkmale aus Ausstattungs-/Eignungslisten der Quellseiten (deutsche
 * Begriffe verschiedener Anbieter) — bewusst getrennt von der Text-
 * Heuristik in accessibility.ts, hier sind es strukturierte Listen.
 */
export function featuresFromLabels(labels: string[]): AccessibilityFeature[] {
  const out = new Set<AccessibilityFeature>();
  for (const raw of labels) {
    const l = raw.toLowerCase();
    if (/rollstuhl|barrierefreier eingang|barrierefreier zugang|stufenlos|barrierefrei zug/.test(l)) out.add('rollstuhl');
    if (/wc|toilette/.test(l) && /barrierefrei|rollstuhl|behinderten/.test(l)) out.add('wc');
    if (/parkpl/.test(l) && /behinderten|barrierefrei|rollstuhl/.test(l)) out.add('parkplatz');
    if (/aufzug|\blift\b|fahrstuhl|treppenlift/.test(l)) out.add('lift');
    if (/verleih von rollator|leihrollstuhl|rollstuhlverleih|rollstuhl.*(leih|ausleih)/.test(l)) out.add('leihrollstuhl');
    if (/badelift|poollift|pool-lift|schwimmrollstuhl/.test(l)) out.add('badelift');
    if (/sehbehinder|blinde|taktil|tastmodell|audiodeskription|braille/.test(l)) out.add('blind');
    if (/hörbehinder|hoerbehinder|gehörlos|gehoerlos|ögs|gebärden|gebaerden|induktive höranlage|induktive hoeranlage/.test(l)) out.add('gehoerlos');
    if (/leichte(r|n)? sprache|einfache(r|n)? sprache/.test(l)) out.add('leichte-sprache');
    if (/begleithund|assistenzhund|blindenhund/.test(l)) out.add('assistenzhund');
  }
  // Vokabular-Reihenfolge
  const order: AccessibilityFeature[] = ['rollstuhl', 'parkplatz', 'wc', 'lift', 'leihrollstuhl', 'badelift', 'blind', 'gehoerlos', 'leichte-sprache', 'assistenzhund'];
  return order.filter((f) => out.has(f));
}

export function writeDataset(file: DatasetFile): void {
  const validated = validateDatasetFile(file, `${file.source}.json`);
  mkdirSync(DATA_DIR, { recursive: true });
  const path = join(DATA_DIR, `${file.source}.json`);
  writeFileSync(path, JSON.stringify(validated, null, 2) + '\n');
  console.log(`[barrierefrei] ${validated.entries.length} Eintraege -> ${path}`);
}

export function dedupeEntries(entries: DatasetEntry[]): DatasetEntry[] {
  const seen = new Set<string>();
  const out: DatasetEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}
