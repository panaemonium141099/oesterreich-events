/**
 * Hero-Bild für einen Saison-Post aus Wikimedia Commons holen (fn-24).
 *
 * Nutzt dieselbe kuratierte Suche wie der Autopilot (src/lib/blog/hero-image.ts)
 * inklusive Relevanz-Gate, legt die Datei unter public/images/blog/<slug>/ ab
 * und gibt heroImage/heroImageCredit/heroLayout zum Eintragen aus.
 *
 * Ein Saison-Hero wird bewusst mit Augenschein ausgewählt: das Relevanz-Gate
 * verhindert thematisch falsche Treffer, aber nicht hässliche. Mit --url wird
 * eine konkret geprüfte Commons-Datei übernommen statt der ersten Suchtreffer.
 *
 * Aufruf: npx tsx src/scripts/fetch-saison-hero.ts <slug> "<Suchanfrage>"
 *         npx tsx src/scripts/fetch-saison-hero.ts <slug> "<Suchanfrage>" --url <commons-url> --credit "<Foto: …>"
 */
import fs from 'node:fs';
import path from 'node:path';
import { findCommonsPhoto, fetchImage, layoutFor } from '../lib/blog/hero-image';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [slug, query] = argv;
  const urlIdx = argv.indexOf('--url');
  const creditIdx = argv.indexOf('--credit');
  if (!slug || !query) {
    console.error('Aufruf: fetch-saison-hero.ts <slug> "<Suchanfrage>" [--url <u> --credit <c>]');
    process.exit(1);
  }

  if (urlIdx !== -1) {
    const url = argv[urlIdx + 1];
    const credit = creditIdx !== -1 ? argv[creditIdx + 1] : 'Foto: Wikimedia Commons';
    const dl = await fetchImage(url);
    if (!dl) { console.error(`Download fehlgeschlagen: ${url}`); process.exit(1); }
    const destDir = path.join(process.cwd(), 'public', 'images', 'blog', slug);
    fs.mkdirSync(destDir, { recursive: true });
    for (const f of fs.readdirSync(destDir)) {
      if (/^hero\.(jpe?g|png|webp)$/i.test(f)) fs.unlinkSync(path.join(destDir, f));
    }
    fs.writeFileSync(path.join(destDir, `hero.${dl.ext}`), dl.buf);
    console.log(`Groesse:  ${dl.width}x${dl.height}`);
    console.log(`heroImage:       "/images/blog/${slug}/hero.${dl.ext}"`);
    console.log(`heroImageCredit: ${JSON.stringify(credit)}`);
    console.log(`heroLayout:      "${layoutFor(dl.width)}"`);
    return;
  }

  const hit = await findCommonsPhoto(query, {
    onReject: (url) => console.log(`  verworfen (Thema passt nicht): ${url.split('/').pop()}`),
  });
  if (!hit) {
    console.error(`Kein passendes Commons-Foto für "${query}".`);
    process.exit(1);
  }

  const dl = await fetchImage(hit.url);
  if (!dl) {
    console.error(`Download fehlgeschlagen: ${hit.url}`);
    process.exit(1);
  }

  const destDir = path.join(process.cwd(), 'public', 'images', 'blog', slug);
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(destDir)) {
    if (/^hero\.(jpe?g|png|webp)$/i.test(f)) fs.unlinkSync(path.join(destDir, f));
  }
  const file = `hero.${dl.ext}`;
  fs.writeFileSync(path.join(destDir, file), dl.buf);

  console.log(`\nQuelle:   ${hit.url}`);
  console.log(`Groesse:  ${dl.width}x${dl.height}`);
  console.log(`heroImage:       "/images/blog/${slug}/${file}"`);
  console.log(`heroImageCredit: ${JSON.stringify(hit.credit)}`);
  console.log(`heroLayout:      "${layoutFor(dl.width)}"`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
