/**
 * Decode the handful of HTML entities scrapers leave in event titles
 * ("PSYCH &#8211; LUXUSGOLD"). Cheap inline pass — covers numeric
 * entities + the most common named ones, no DOM round-trip.
 */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
