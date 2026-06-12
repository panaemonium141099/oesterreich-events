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
