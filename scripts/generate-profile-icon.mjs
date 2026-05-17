/**
 * One-off: render the Lasstreffen pin-glyph as a high-res PNG so we can
 * upload it to external profile/affiliate platforms without pixelation.
 *
 * Same teardrop pin + dot used by apple-icon.tsx, but rendered through
 * sharp from an SVG so we get crisp output at any size.
 *
 * Outputs:
 *   ~/Downloads/lasstreffen-icon-1024.png   (square, dark bg, pin + caption)
 *   ~/Downloads/lasstreffen-pin-1024.png    (transparent bg, pin only)
 */

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SIZE = 1024;
const OUT_DIR = join(homedir(), 'Downloads');

// ─── Variant A: full square icon (dark bg + pin + caption) ───────────
const svgFull = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="vignette" cx="30%" cy="20%" r="60%">
      <stop offset="0%" stop-color="rgba(245,239,226,0.08)"/>
      <stop offset="55%" stop-color="rgba(245,239,226,0)"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="#0a0a0c"/>
  <rect width="1024" height="1024" fill="url(#vignette)"/>
  <g transform="translate(384, 270) scale(10.67)">
    <path
      d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z"
      fill="#c8553d"/>
    <circle cx="12" cy="11.5" r="4" fill="#f3ecdb"/>
  </g>
  <text
    x="512" y="900"
    text-anchor="middle"
    font-family="Geist, Inter, system-ui, sans-serif"
    font-size="56" font-weight="500"
    letter-spacing="15.7"
    fill="#9a938a"
    style="text-transform: uppercase;"
  >LASS TREFFEN</text>
</svg>`;

// ─── Variant B: pin glyph only on transparent background ─────────────
const svgPinOnly = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 30">
  <path
    d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z"
    fill="#c8553d"/>
  <circle cx="12" cy="11.5" r="4" fill="#f3ecdb"/>
</svg>`;

async function render(svg, outName) {
  const out = join(OUT_DIR, outName);
  await sharp(Buffer.from(svg), { density: 600 })
    .resize(SIZE, SIZE)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✔ ${out}`);
}

await render(svgFull, 'lasstreffen-icon-1024.png');
await render(svgPinOnly, 'lasstreffen-pin-1024.png');
