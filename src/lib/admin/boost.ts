/**
 * Client-Helper für die Admin-Boost-API.
 *
 * Berechnet aus der gewählten Dauer ein boost_until-Enddatum (days=0 =>
 * unbegrenzt/null) und ruft POST /api/admin/boost auf. Wirft bei Fehler,
 * gibt sonst den neuen Boost-Zustand zurück.
 */
export async function setEventBoost(
  eventId: string,
  boosted: boolean,
  days = 0
): Promise<{ is_boosted: boolean; boost_until: string | null }> {
  const until =
    boosted && days > 0
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null;

  const res = await fetch('/api/admin/boost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, boosted, until, tier: 'boost' }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Boost fehlgeschlagen');
  }

  return { is_boosted: boosted, boost_until: until };
}

/**
 * Buchung für die Startseite (fn-30):
 *   * editorial: Pin in die Saison-Karte, days=0 => bis das Event vorbei ist.
 *   * sponsored: Tipp des Tages am Wiener Kalendertag `day` (YYYY-MM-DD) mit
 *     Pflichtfeld `sponsorName` (die Karte trägt „Anzeige“ plus Sponsor).
 */
export type LandingFeatureBooking =
  | { kind: 'editorial'; days?: number }
  | { kind: 'sponsored'; sponsorName: string; day: string };

export interface LandingFeatureResult {
  kind: 'sponsored' | 'editorial';
  sponsor_name: string | null;
  starts_at: string;
  ends_at: string | null;
}

/**
 * Bucht ein Event auf die Startseite oder nimmt es herunter. Die API prüft
 * Event (published, AT, am Buchungstag nicht vorbei → sonst 422) und bei
 * `sponsored` die Belegung des Tages (409 mit dem belegten Event); die
 * Fehlermeldung der API landet in der geworfenen Error. Die Startseite wird
 * danach neu gebaut (revalidatePath).
 */
export async function setLandingFeature(
  eventId: string,
  featured: boolean,
  booking: LandingFeatureBooking = { kind: 'editorial', days: 0 }
): Promise<LandingFeatureResult | null> {
  const payload: Record<string, unknown> = { eventId, featured, kind: booking.kind };
  if (featured && booking.kind === 'editorial') {
    const days = booking.days ?? 0;
    payload.until = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  }
  if (featured && booking.kind === 'sponsored') {
    payload.sponsorName = booking.sponsorName;
    payload.day = booking.day;
  }

  const res = await fetch('/api/admin/landing-feature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Startseiten-Buchung fehlgeschlagen');
  }

  return (data.feature as LandingFeatureResult | undefined) ?? null;
}
