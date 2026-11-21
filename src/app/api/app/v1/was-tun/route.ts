/**
 * GET /api/app/v1/was-tun — Einstieg von „Was kann man in X machen?" für
 * die native App: Bundesländer und Tourismusregionen (wie /was-tun der
 * Website). Statische Daten aus dem Repo, keine Abfrage.
 */
import { NextResponse } from 'next/server';
import { toAppWasTunIndex } from '@/lib/app-api/was-tun';

export function GET() {
  return NextResponse.json(toAppWasTunIndex(), {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  });
}
