/**
 * /sitemap-events-2.xml — Shard 1 des Event-Sitemap-Splits.
 * Logik + Begruendung: src/lib/seo/sitemap-events-shard.ts.
 */

import type { NextResponse } from 'next/server';
import { buildEventsShardResponse } from '@/lib/seo/sitemap-events-shard';

export const dynamic = 'force-dynamic';
export const revalidate = 300;
/** Siehe Kommentar in sitemap-events.xml/route.ts (Shard 0). */
export const maxDuration = 60;

export async function GET(): Promise<NextResponse> {
  return buildEventsShardResponse(1);
}
