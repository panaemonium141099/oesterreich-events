/**
 * Download all blog post images locally and update post files.
 * Usage: node scripts/download-blog-images.mjs
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, '../src/content/blog/posts');
const PUBLIC_DIR = path.join(__dirname, '../public/images/blog');

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    });
    req.on('error', (err) => { file.close(); try { fs.unlinkSync(destPath); } catch {} reject(err); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function extractSlug(filename) {
  return filename.replace(/\.ts$/, '');
}

function extractUrls(content) {
  const results = { hero: null, thumb: null, gallery: [] };

  // heroImage: 'https://...'  or  heroImage:\n    'https://...'
  const heroMatch = content.match(/heroImage:\s*\n?\s*'(https?:\/\/[^']+)'/);
  if (heroMatch) results.hero = heroMatch[1];

  // thumbnailImage
  const thumbMatch = content.match(/thumbnailImage:\s*\n?\s*'(https?:\/\/[^']+)'/);
  if (thumbMatch) results.thumb = thumbMatch[1];

  // gallery src fields
  const gallerySrcRegex = /src:\s*'(https?:\/\/[^']+)'/g;
  let m;
  while ((m = gallerySrcRegex.exec(content)) !== null) {
    results.gallery.push(m[1]);
  }

  return results;
}

function replaceUrls(content, slug, urls) {
  let updated = content;

  if (urls.hero) {
    const localPath = `/images/blog/${slug}/hero.jpg`;
    updated = updated.replace(
      /heroImage:\s*\n?\s*'https?:\/\/[^']+'/,
      `heroImage: '${localPath}'`
    );
  }

  if (urls.thumb) {
    const localPath = `/images/blog/${slug}/thumb.jpg`;
    updated = updated.replace(
      /thumbnailImage:\s*\n?\s*'https?:\/\/[^']+'/,
      `thumbnailImage: '${localPath}'`
    );
  }

  urls.gallery.forEach((url, i) => {
    const localPath = `/images/blog/${slug}/gallery-${i + 1}.jpg`;
    updated = updated.replace(url, localPath);
  });

  return updated;
}

async function processPost(filename) {
  const slug = extractSlug(filename);
  const filePath = path.join(POSTS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const urls = extractUrls(content);

  const slugDir = path.join(PUBLIC_DIR, slug);
  fs.mkdirSync(slugDir, { recursive: true });

  const downloads = [];
  const downloadResults = { hero: false, thumb: false, gallery: [] };

  // Hero
  if (urls.hero) {
    const dest = path.join(slugDir, 'hero.jpg');
    if (!fs.existsSync(dest)) {
      downloads.push(downloadFile(urls.hero, dest).then(() => { downloadResults.hero = true; }).catch(e => console.error(`  [FAIL] hero: ${e.message}`)));
    } else {
      downloadResults.hero = true;
    }
  }

  // Thumb
  if (urls.thumb) {
    const dest = path.join(slugDir, 'thumb.jpg');
    if (!fs.existsSync(dest)) {
      downloads.push(downloadFile(urls.thumb, dest).then(() => { downloadResults.thumb = true; }).catch(e => console.error(`  [FAIL] thumb: ${e.message}`)));
    } else {
      downloadResults.thumb = true;
    }
  }

  // Gallery
  for (let i = 0; i < urls.gallery.length; i++) {
    const dest = path.join(slugDir, `gallery-${i + 1}.jpg`);
    const idx = i;
    if (!fs.existsSync(dest)) {
      downloads.push(downloadFile(urls.gallery[idx], dest).then(() => { downloadResults.gallery[idx] = true; }).catch(e => console.error(`  [FAIL] gallery-${idx + 1}: ${e.message}`)));
    } else {
      downloadResults.gallery[idx] = true;
    }
  }

  await Promise.all(downloads);

  // Update file
  const updated = replaceUrls(content, slug, urls);
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }

  const galleryCount = urls.gallery.length;
  console.log(`✓ ${slug} — hero:${downloadResults.hero ? '✓' : '✗'} thumb:${downloadResults.thumb !== false ? '✓' : '–'} gallery:${galleryCount}`);
}

async function main() {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.ts'));
  console.log(`Processing ${files.length} posts...\n`);

  // Process in batches of 5 to avoid overwhelming network
  const BATCH = 5;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    await Promise.all(batch.map(f => processPost(f)));
  }

  console.log('\nDone! Check public/images/blog/ for downloaded images.');
}

main().catch(console.error);
