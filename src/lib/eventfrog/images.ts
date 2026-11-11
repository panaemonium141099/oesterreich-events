import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';

/**
 * Eventfrog-Bilder in unseren Storage spiegeln.
 *
 * Die Public-API-Doku verbietet Hotlinking: Bild-URLs seien „for reference
 * only", nicht stabil, und sollen beim Import heruntergeladen und aus
 * eigenem Speicher ausgeliefert werden. Deshalb landet KEIN
 * res.eventfrog.net-Link in der DB: entweder die Storage-URL oder gar kein
 * Bild (die UI fällt dann auf das Kategoriebild zurück).
 *
 * Ablage: Bucket `event-images`, Pfad `eventfrog/<sha1 des URL-Pfads>.<ext>`.
 * Der Dateiname bei Eventfrog trägt einen eigenen Code und ändert sich mit
 * dem Bild; der `?_=`-Cache-Buster zählt deshalb nicht zur Identität.
 */

export const EVENT_IMAGES_BUCKET = 'event-images';
const FOLDER = 'eventfrog';
const MAX_BYTES = 5 * 1024 * 1024;
const CONCURRENCY = 4;
const LIST_PAGE = 1000;

export function storagePathFor(sourceUrl: string): string {
  const pathname = new URL(sourceUrl).pathname;
  const ext = (pathname.match(/\.(webp|jpe?g|png|gif|avif)$/i)?.[1] ?? 'img').toLowerCase();
  const hash = createHash('sha1').update(pathname).digest('hex').slice(0, 24);
  return `${FOLDER}/${hash}.${ext}`;
}

async function ensureBucket(db: SupabaseClient): Promise<void> {
  const { data } = await db.storage.getBucket(EVENT_IMAGES_BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(EVENT_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif'],
  });
  if (error && !/exists/i.test(error.message)) throw new Error(`Bucket ${EVENT_IMAGES_BUCKET}: ${error.message}`);
}

async function existingNames(db: SupabaseClient): Promise<Set<string>> {
  const out = new Set<string>();
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await db.storage.from(EVENT_IMAGES_BUCKET).list(FOLDER, { limit: LIST_PAGE, offset });
    if (error) throw new Error(`Storage-Liste ${FOLDER}: ${error.message}`);
    for (const f of data ?? []) out.add(`${FOLDER}/${f.name}`);
    if (!data || data.length < LIST_PAGE) break;
  }
  return out;
}

async function download(url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!type.startsWith('image/')) return null;
  const body = await res.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return null;
  return { body, type };
}

export interface MirrorResult {
  uploaded: number;
  reused: number;
  failed: number;
  failedSamples: string[];
}

/**
 * Ersetzt `image_url` jedes Events durch die Storage-URL. Was sich nicht
 * spiegeln lässt, verliert das Bild samt Maßen und Bildnachweis.
 */
export async function mirrorEventfrogImages(
  events: ScrapedEvent[],
  db: SupabaseClient,
  log: (msg: string) => void = () => {},
): Promise<MirrorResult> {
  await ensureBucket(db);
  const have = await existingNames(db);
  const result: MirrorResult = { uploaded: 0, reused: 0, failed: 0, failedSamples: [] };

  const sources = [...new Set(events.map((e) => e.image_url).filter((u): u is string => !!u))];
  const mirrored = new Map<string, string>();
  let next = 0;
  async function worker() {
    while (next < sources.length) {
      const src = sources[next++];
      const path = storagePathFor(src);
      const publicUrl = db.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
      if (have.has(path)) {
        mirrored.set(src, publicUrl);
        result.reused++;
        continue;
      }
      try {
        const file = await download(src);
        if (!file) throw new Error('kein Bild');
        const { error } = await db.storage.from(EVENT_IMAGES_BUCKET)
          .upload(path, file.body, { contentType: file.type, upsert: false, cacheControl: '31536000' });
        if (error && !/exists/i.test(error.message)) throw new Error(error.message);
        mirrored.set(src, publicUrl);
        result.uploaded++;
      } catch (err) {
        result.failed++;
        if (result.failedSamples.length < 5) result.failedSamples.push(`${src}: ${(err as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sources.length) }, worker));
  log(`Bilder: ${result.uploaded} hochgeladen, ${result.reused} schon vorhanden, ${result.failed} fehlgeschlagen`);

  for (const e of events) {
    if (!e.image_url) continue;
    const url = mirrored.get(e.image_url);
    if (url) {
      e.image_url = url;
    } else {
      e.image_url = undefined;
      e.image_width = undefined;
      e.image_height = undefined;
      e.image_credit = undefined;
    }
  }
  return result;
}
