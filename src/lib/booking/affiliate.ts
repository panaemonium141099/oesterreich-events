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
 * Stadt aus einem Location-/Adress-Freitext ableiten.
 *
 *   "Theaterplatz 7, 2500 Baden, Niederösterreich" → "Baden"   (PLZ+Stadt)
 *   "Baden, Theaterplatz 7"                        → "Baden"   (Straße übersprungen)
 *   "Schloss Esterhazy, Eisenstadt"                → "Eisenstadt"
 *
 * Reihenfolge: (1) PLZ+Stadt-Muster irgendwo im String gewinnt; (2) sonst
 * Komma-Teile von hinten, wobei Teile mit Ziffern (Straße+Hausnummer) und
 * "Österreich"/"Austria" übersprungen werden. Liefert null, wenn nichts
 * Stadtartiges übrig bleibt (Box wird dann nicht gerendert).
 */
/**
 * Nur Kandidaten akzeptieren, die wie ein Ortsname aussehen: beginnt mit
 * Buchstabe, danach Buchstaben/Leerzeichen/.'-/() — verwirft Emojis und
 * Sonderzeichen-Müll aus gescrapten Adressfeldern (Live-Befund: Event mit
 * Emoji im Adressfeld ergab "Alle Unterkünfte in 🙄").
 */
function isCityLike(candidate: string): boolean {
  return /^[\p{L}][\p{L}\p{M}\s.'()\/-]{1,59}$/u.test(candidate);
}

export function deriveCityFromLocation(location: string | null | undefined): string | null {
  const loc = (location ?? '').trim();
  if (!loc) return null;

  // (1) "2500 Baden" / "9020 Klagenfurt am Wörthersee" — Stadt nach 4-stelliger PLZ
  const plzMatch = loc.match(/\b\d{4}\s+([^\d,]+?)(?:,|$)/);
  if (plzMatch) {
    const city = plzMatch[1].trim();
    if (city && isCityLike(city)) return city;
  }

  // (2) Komma-Teile von hinten; Straßen (enthalten Ziffern), Landesnamen
  //     und Nicht-Ortsnamen (Emojis etc.) raus
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = parts[i];
    if (/^(österreich|austria)$/i.test(candidate)) continue;
    if (/\d/.test(candidate)) continue;
    if (!isCityLike(candidate)) continue;
    return candidate;
  }
  return null;
}
