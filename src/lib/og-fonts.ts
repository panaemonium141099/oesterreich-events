/**
 * Google Fonts loader for next/og's ImageResponse.
 *
 * IMPORTANT: Satori (the rasterizer inside ImageResponse) does NOT
 * support WOFF2 — it needs TTF/OTF bytes. By default, Google Fonts'
 * CSS2 endpoint serves WOFF2 to any UA that accepts it. The workaround:
 * pass a `text=` subset parameter, which flips Google to a per-request
 * TTF slice containing just those glyphs. Smaller, faster, AND decodable
 * by Satori.
 *
 * Caller is responsible for passing the text that will actually be
 * rendered, so Google knows which glyphs to include.
 */

export type FontSpec = {
  /** Google Fonts family name, e.g. "Fraunces" */
  family: string;
  /** Numeric weight, e.g. 400, 500, 700 */
  weight?: number;
  /** "normal" or "italic" */
  style?: 'normal' | 'italic';
  /**
   * Characters that will be rendered. REQUIRED — this flips Google to
   * TTF instead of WOFF2. Pass a superset if you're not sure what
   * exact chars you need; Google will silently ignore unused ones.
   */
  text: string;
};

export async function loadGoogleFont(spec: FontSpec): Promise<ArrayBuffer> {
  const weight = spec.weight ?? 400;
  const italic = spec.style === 'italic';
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec.family)}:${axis}` +
    `&text=${encodeURIComponent(spec.text)}`;

  const cssResp = await fetch(cssUrl);
  if (!cssResp.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssResp.status}`);
  const css = await cssResp.text();

  // Only match TTF/OTF — WOFF2 is not supported by Satori.
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/);
  if (!match) {
    throw new Error(
      `No TTF/OTF URL found in Google Fonts CSS for "${spec.family}". ` +
      `First 200 chars of response: ${css.substring(0, 200)}`,
    );
  }
  const fontResp = await fetch(match[1]);
  if (!fontResp.ok) throw new Error(`Font file fetch failed: ${fontResp.status}`);
  return await fontResp.arrayBuffer();
}
