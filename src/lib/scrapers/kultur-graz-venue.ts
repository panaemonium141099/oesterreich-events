/**
 * Veranstaltungsort von kultur.graz.at bereinigen. Die Quelle führt für
 * Stadtgebiet-Termine (Rundgänge, Ausstellungen im öffentlichen Raum) den
 * Ort „Graz"; das ist die Stadt, kein Venue, und bleibt deshalb leer.
 * Ebenso Zeit- und Hinweislabels, die ein Parser an dieser Stelle fassen
 * könnte („Beginnzeit nicht bekannt", „Ganztägig", „Eröffnung").
 */
const NOT_A_VENUE = /^(graz|stadtgebiet|beginnzeit nicht bekannt|ganztägig|eröffnung|vernissage|finissage|premiere)$/i;

export function cleanKulturGrazVenue(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const v = raw.replace(/\s+/g, ' ').replace(/^\s*[-–]\s*/, '').trim();
  if (v.length < 2 || v.length > 100) return undefined;
  if (NOT_A_VENUE.test(v)) return undefined;
  if (/\d{1,2}:\d{2}\s*Uhr/i.test(v) || /(Info|Foto)\s*:/.test(v) || v.includes('↗')) return undefined;
  return v;
}
