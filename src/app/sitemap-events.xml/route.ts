/**
 * /sitemap-events.xml — Shard 0 des Event-Sitemap-Splits (2026-08-26).
 *
 * Die gesamte Logik (uuid-Range-Sharding, Keyset-Pagination, hreflang-
 * Paare, Fail-loudly) lebt in src/lib/seo/sitemap-events-shard.ts —
 * route.ts-Dateien vertragen keine freien Exports (Next-Route-Segment-
 * Validierung), und alle Shards teilen sich denselben Handler.
 *
 * Dieser Pfad bleibt bewusst Shard 0 statt zu redirecten: er ist in der
 * GSC als Kind-Sitemap registriert und bleibt so ohne Neueinreichung
 * gueltig. Shards 1..N-1: /sitemap-events-2.xml .. /sitemap-events-N.xml.
 */

import type { NextResponse } from 'next/server';
import { buildEventsShardResponse } from '@/lib/seo/sitemap-events-shard';

export const dynamic = 'force-dynamic';
export const revalidate = 300;
/** ~11 Keyset-Runden a 426 ms (EXPLAIN ANALYZE Prod 2026-08-26) plus
 *  XML-Rendering. Explizites Limit mit Headroom, damit die Route nicht am
 *  Plattform-Default haengenbleibt; erfolgreiche Antworten liegen danach
 *  eine Stunde im CDN (s-maxage=3600). */
export const maxDuration = 60;

export async function GET(): Promise<NextResponse> {
  return buildEventsShardResponse(0);
}
