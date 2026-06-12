/** Normalize any URL/host string to a bare lowercase registrable host
 *  ("https://www.X.com/y" -> "x.com"). Returns null for junk/empty. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = 'http://' + s;
  let host: string;
  try {
    host = new URL(s).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '');
  // must look like a domain (has a dot, valid chars)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  return host;
}
