import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runTranslationBatch } from '@/lib/i18n/translate-batch';

/**
 * Täglicher Nachlauf der DE→EN-Event-Übersetzung.
 *
 * Der einmalige Bestands-Backfill läuft über
 * `src/scripts/translate-events-en.ts` (stundenlang, resumable). Dieser
 * Cron hält den Bestand danach aktuell: die Scraper legen täglich neue
 * Events an, die sonst wieder ohne `title_en` in der Sitemap fehlen und
 * damit für Google englisch nicht existieren.
 *
 * Budget: MAX_EVENTS pro Lauf, hart begrenzt durch DEADLINE_MS deutlich
 * unter dem 900s-curl-Timeout der systemd-Unit (lt-cron@.service) — ein
 * abgeschnittener Lauf ist unkritisch, der nächste macht weiter.
 *
 * Auth: CRON_SECRET als Bearer-Token (wie die übrigen Cron-Routen).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const MAX_EVENTS = 1200;
const DEADLINE_MS = 600_000; // 10 min — curl-Timeout der Unit ist 900 s
const CONCURRENCY = 4;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY fehlt' }, { status: 500 });
  }
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase-Zugang fehlt' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let result;
  try {
    result = await runTranslationBatch(supabase, apiKey, {
      limit: MAX_EVENTS,
      concurrency: CONCURRENCY,
      deadlineMs: DEADLINE_MS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Batch fehlgeschlagen', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Nur-Fehler-Lauf = Key/Quota kaputt. 502 statt stiller 200, sonst
  // meldet der Timer monatelang grün ohne eine Zeile zu übersetzen.
  if (result.processed > 0 && result.translated === 0 && result.failed > 0) {
    return NextResponse.json(
      { error: 'Keine Übersetzung erfolgreich — Gemini-Key oder Quota prüfen', ...result },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
