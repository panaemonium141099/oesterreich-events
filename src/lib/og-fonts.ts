/**
 * Google Fonts loader for next/og's ImageResponse.
 *
 * Fetches a single-weight woff2 font file at request/build time so the
 * Satori renderer inside ImageResponse can actually use the glyphs.
 * next/font doesn't expose raw font bytes, which is why this helper
 * exists — OG routes need the buffer.
 *
 * The CSS endpoint returns a stylesheet with a URL pointing at the
 * actual woff2; we regex that out and fetch the binary.
 *
 * Requires a realistic User-Agent. Google Fonts CSS2 serves woff2 only
 * to UAs that claim to support it — a bare "node-fetch" string gets you
 * older ttf URLs.
 */

export type FontSpec = {
  /** Google Fonts family name, e.g. "Fraunces" */
  family: string;
  /** Numeric weight, e.g. 400, 500, 700 */
  weight?: number;
  /** "normal" or "italic" — italic requires the `ital,wght@1,...` syntax */
  style?: 'normal' | 'italic';
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function loadGoogleFont(spec: FontSpec): Promise<ArrayBuffer> {
  const weight = spec.weight ?? 400;
  const italic = spec.style === 'italic';
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec.family)}:${axis}` +
    `&display=swap`;

  const css = await fetch(cssUrl, { headers: { 'User-Agent': BROWSER_UA } }).then(r => {
    if (!r.ok) throw new Error(`CSS fetch failed: ${r.status}`);
    return r.text();
  });
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]woff2['"]\)/);
  if (!match) throw new Error(`No woff2 URL found in CSS for ${spec.family}`);
  const fontResp = await fetch(match[1]);
  if (!fontResp.ok) throw new Error(`Font fetch failed: ${fontResp.status}`);
  return await fontResp.arrayBuffer();
}
