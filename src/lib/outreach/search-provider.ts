// Pluggable web-search source for cold discovery + monitoring. Today: Google
// CSE (free tier). The interface lets us swap in Brave / link-mining later.

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

export class GoogleCseProvider implements SearchProvider {
  constructor(private key: string, private cx: string) {}

  async search(query: string): Promise<SearchResult[]> {
    const u = `https://www.googleapis.com/customsearch/v1?key=${this.key}&cx=${this.cx}` +
      `&q=${encodeURIComponent(query)}&num=10&gl=at&lr=lang_de`;
    try {
      const res = await fetch(u);
      if (!res.ok) return [];
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data.items ?? []) as any[]).map((it) => ({
        url: it.link as string,
        title: (it.title as string) ?? '',
        snippet: (it.snippet as string) ?? '',
      }));
    } catch {
      return [];
    }
  }
}

/** Returns a configured provider, or null if GOOGLE_CSE_KEY/CX aren't set. */
export function getSearchProvider(): SearchProvider | null {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return null;
  return new GoogleCseProvider(key, cx);
}
