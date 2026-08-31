/**
 * Booking.com-Affiliate über CJ (Commission Junction) — fn-21.
 *
 * Booking.com DACH (Advertiser 4297289) läuft für uns über CJ:
 *   - Publisher-ID (PID)     : 101870737 ("LassTreffen"-Website im CJ-Konto)
 *   - Deeplink-Link-ID       : 14082404  ("Booking.com use for deep linking")
 *
 * CJ-Deeplink-Format: https://www.kqzyfj.com/click-<PID>-<LINKID>?sid=<SID>&url=<encodedTarget>
 * Der Redirect setzt das CJ-Tracking (CJEVENT), sid taucht in den
 * CJ-Reports auf → pro Platzierung auswertbar.
 *
 * sid-Konvention (Platzierungs-Attribution):
 *   plan | blog-<slug> | event-<shortid> | stay-article-<slug>
 *
 * Reine Pure-Functions, keine Seiteneffekte — getestet in __tests__/affiliate.test.ts.
 */

const CJ_PID = '101870737';
const CJ_DEEPLINK_ID = '14082404';
const CJ_CLICK_BASE = `https://www.kqzyfj.com/click-${CJ_PID}-${CJ_DEEPLINK_ID}`;

/** Beliebige booking.com-Ziel-URL in den CJ-Affiliate-Klick einpacken. */
export function wrapBookingAffiliate(targetUrl: string, sid: string): string {
  const cleanSid = sid.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60);
  return `${CJ_CLICK_BASE}?sid=${encodeURIComponent(cleanSid)}&url=${encodeURIComponent(targetUrl)}`;
}

export interface StaySearchOptions {
  /** Suchbegriff: Stadt ("Eisenstadt") oder Unterkunftsname + Ort ("Hotel Sacher Wien"). */
  ss: string;
  /** Check-in YYYY-MM-DD. Weglassen → Suche ohne Datum (Evergreen-Links). */
  checkin?: string | null;
  /** Übernachtungen ab checkin (default 1). */
  nights?: number;
}

/**
 * booking.com-Such-URL (unaffiliert) bauen. Für Links IMMER zusätzlich
 * durch wrapBookingAffiliate() schicken — sonst Provision verschenkt.
 */
export function buildStaySearchUrl({ ss, checkin, nights = 1 }: StaySearchOptions): string {
  const params = new URLSearchParams();
  const term = ss.trim();
  if (term) params.set('ss', term);
  if (checkin && /^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
    params.set('checkin', checkin);
    const d = new Date(`${checkin}T12:00:00Z`);
    if (!isNaN(d.getTime())) {
      d.setUTCDate(d.getUTCDate() + Math.max(1, nights));
      params.set('checkout', d.toISOString().slice(0, 10));
    }
  }
  params.set('group_adults', '2');
  params.set('no_rooms', '1');
  params.set('lang', 'de');
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

/** Komfort: Stadt+Datum-Suche, fertig affiliert. */
export function buildAffiliateStayLink(opts: StaySearchOptions, sid: string): string {
  return wrapBookingAffiliate(buildStaySearchUrl(opts), sid);
}

/**
 * Stadt aus einem Location-Freitext ableiten ("Schloss Esterhazy, Eisenstadt"
 * → "Eisenstadt"; "Messeplatz 1, 9020 Klagenfurt am Wörthersee" → "Klagenfurt
 * am Wörthersee"). Nimmt den letzten Komma-Teil und streift eine führende PLZ.
 * Liefert null, wenn nichts Brauchbares übrig bleibt.
 */
export function deriveCityFromLocation(location: string | null | undefined): string | null {
  const loc = (location ?? '').trim();
  if (!loc) return null;
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  let candidate = parts.length ? parts[parts.length - 1] : loc;
  // "Österreich"/"Austria" als letzter Teil → einen weiter nach vorn
  if (/^(österreich|austria)$/i.test(candidate) && parts.length >= 2) {
    candidate = parts[parts.length - 2];
  }
  candidate = candidate.replace(/^\d{4}\s+/, '').trim(); // führende PLZ
  if (!candidate || /^\d+$/.test(candidate)) return null;
  return candidate;
}
