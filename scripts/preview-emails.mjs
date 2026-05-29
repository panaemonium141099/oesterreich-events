#!/usr/bin/env node
/**
 * Email-Template-Preview.
 *
 * Rendert die 3 Lifecycle-Cohorts (welcome / reactivation / weekend) mit
 * realistischen Mock-Daten als HTML-Files in `tmp/email-previews/`. Optional
 * werden mit Puppeteer PNG-Screenshots erzeugt (falls puppeteer installiert).
 *
 * Aufruf:
 *   node scripts/preview-emails.mjs            # nur HTML
 *   node scripts/preview-emails.mjs --png      # HTML + PNG (braucht puppeteer)
 *
 * Output:
 *   tmp/email-previews/lifecycle-welcome.html
 *   tmp/email-previews/lifecycle-reactivation.html
 *   tmp/email-previews/lifecycle-weekend.html
 *   tmp/email-previews/lifecycle-*.png  (optional)
 *
 * Im Browser via file:// oeffnen — Mail-Clients (Apple Mail, Gmail-Web,
 * Thunderbird) zeigen das gleiche Markup.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Run via `npx tsx scripts/preview-emails.mjs` so the .tsx import works.
const { renderLifecycleEmail } = await import(
  pathToFileURL(path.join(repoRoot, 'src/emails/lifecycle-weekend.tsx')).href
);

const outDir = path.join(repoRoot, 'tmp', 'email-previews');
await mkdir(outDir, { recursive: true });

// ── Mock data ────────────────────────────────────────────────────────────

const mockEvents = [
  {
    title: 'Wanda — Open Air 2026',
    date: 'Sa, 31. Mai',
    time: '20:00',
    venueName: 'Allianz Stadion, Wien',
    imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400',
    eventPageUrl: 'https://lasstreffen.at/events/1010-wien/2026-05-31/wanda-open-air',
    category: 'Konzert',
  },
  {
    title: 'Pinzgauer Bauernherbst — Volksmusik & Schmankerl',
    date: 'So, 1. Juni',
    venueName: 'Hauptplatz Zell am See',
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400',
    eventPageUrl: 'https://lasstreffen.at/events/5700-zell-am-see/2026-06-01/bauernherbst',
    category: 'Festival',
  },
  {
    title: 'Wiener Wein-Wanderung durch die Hietzinger Riede',
    date: 'Sa, 31. Mai',
    time: '14:00',
    venueName: 'Heuriger Lentner, Wien',
    imageUrl: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400',
    eventPageUrl: 'https://lasstreffen.at/events/1130-wien/2026-05-31/wein-wanderung',
    category: 'Genuss',
  },
  {
    title: 'Stadtfest Eisenstadt — Live-Musik auf 4 Bühnen',
    date: 'Fr, 30. Mai',
    time: '18:00',
    venueName: 'Hauptstraße Eisenstadt',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
    eventPageUrl: 'https://lasstreffen.at/events/7000-eisenstadt/2026-05-30/stadtfest',
    category: 'Stadtfest',
  },
  {
    title: 'Sonntags-Brunch mit DJ am Neusiedler See',
    date: 'So, 1. Juni',
    time: '11:00',
    venueName: 'Mole West, Neusiedl',
    imageUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400',
    eventPageUrl: 'https://lasstreffen.at/events/7100-neusiedl/2026-06-01/mole-west-brunch',
    category: 'Brunch',
  },
];

const baseUrl = 'https://lasstreffen.at';
const previewToken = 'mock-token';

// Use the local PNG so screenshots show the logo before any deploy.
const logoUrl = pathToFileURL(path.join(repoRoot, 'public/email/logo-light.png')).href;

const cohorts = [
  {
    key: 'welcome',
    label: 'Welcome',
    data: {
      cohort: 'welcome',
      firstName: 'Jonathan',
      cityName: 'Eisenstadt',
      events: mockEvents,
      exploreUrl: `${baseUrl}/entdecken?bundesland=Burgenland`,
      unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?token=${previewToken}`,
      preferencesUrl: `${baseUrl}/profil/notifications`,
      logoUrl,
    },
  },
  {
    key: 'reactivation',
    label: 'Reactivation (Win-back)',
    data: {
      cohort: 'reactivation',
      firstName: 'Sanja',
      cityName: 'Salzburg',
      events: mockEvents,
      exploreUrl: `${baseUrl}/entdecken?bundesland=Salzburg`,
      unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?token=${previewToken}`,
      preferencesUrl: `${baseUrl}/profil/notifications`,
      logoUrl,
    },
  },
  {
    key: 'weekend',
    label: 'Weekend Picks',
    data: {
      cohort: 'weekend',
      cityName: 'Wien',
      events: mockEvents,
      exploreUrl: `${baseUrl}/entdecken?bundesland=Wien&dateRange=weekend`,
      unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?token=${previewToken}`,
      preferencesUrl: `${baseUrl}/profil/notifications`,
      logoUrl,
    },
  },
];

// ── Render HTML ──────────────────────────────────────────────────────────

const renderedFiles = [];
for (const c of cohorts) {
  const { subject, html } = renderLifecycleEmail(c.data);
  const outPath = path.join(outDir, `lifecycle-${c.key}.html`);
  await writeFile(outPath, html, 'utf8');
  renderedFiles.push({ ...c, subject, htmlPath: outPath });
  console.log(`  ✓ ${c.label.padEnd(28)} → ${path.relative(repoRoot, outPath)}`);
  console.log(`    Subject: "${subject}"`);
}

// ── Optional: PNG screenshots via puppeteer ──────────────────────────────

const wantsPng = process.argv.includes('--png');
if (wantsPng) {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch {
    console.error('\n  ✗ puppeteer-core not installed.');
    process.exit(1);
  }

  // Find a system Chrome / Edge instead of downloading Chromium.
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ];
  const { existsSync } = await import('node:fs');
  const executablePath = candidates.find(existsSync);
  if (!executablePath) {
    console.error('\n  ✗ No local Chrome/Edge found.');
    process.exit(1);
  }

  console.log(`\n  Generating PNG screenshots (using ${path.basename(executablePath)})…`);
  const browser = await puppeteer.launch({ headless: true, executablePath });
  try {
    for (const f of renderedFiles) {
      const page = await browser.newPage();
      await page.setViewport({ width: 640, height: 1800, deviceScaleFactor: 2 });
      await page.goto(pathToFileURL(f.htmlPath).href, { waitUntil: 'networkidle0', timeout: 30_000 });
      const pngPath = f.htmlPath.replace(/\.html$/, '.png');
      await page.screenshot({ path: pngPath, fullPage: true });
      console.log(`  ✓ ${f.label.padEnd(28)} → ${path.relative(repoRoot, pngPath)}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log('\n────────────────────────────────────────────────────────────');
console.log('Im Browser oeffnen (Windows):');
for (const f of renderedFiles) {
  console.log(`  ${f.label.padEnd(28)} file:///${f.htmlPath.replace(/\\/g, '/').replace(/^[A-Z]:/, (m) => m)}`);
}
console.log('────────────────────────────────────────────────────────────');
if (!wantsPng) {
  console.log('Tipp: --png flag rendert zusaetzlich PNG-Screenshots.');
}
