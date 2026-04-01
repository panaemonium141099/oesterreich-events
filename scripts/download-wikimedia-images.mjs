/**
 * Download verified Wikipedia Commons images for blog posts and update post files.
 * Usage: node scripts/download-wikimedia-images.mjs
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
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AustriaEventsBlog/1.0)',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    });
    req.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
    req.setTimeout(60000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

// Map: slug -> { hero, gallery: [url, url, url] }
const WIKIMEDIA_IMAGES = {
  'wien-christkindlmarkt': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/2004_11_20_Wien_Advent_003_%2851062080321%29.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/e/e0/2004_11_20_Wien_Advent_005_%2851061363833%29.jpg',
      null, // keep existing
      null,
    ],
  },
  'wiener-silvesterpfad': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Wien_-_Rathaus%2C_Silvester_2013_14.JPG',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/e/e8/20171231_Vienna_New_Year%27s_Eve_Trail_D20_5888.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/9/94/Silvesterpfad_2010_Wien_Graben.JPG',
      null,
    ],
  },
  'wiener-opernball': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Opernball_0658.JPG',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/a/a8/Operball_2009.jpg',
      null,
      null,
    ],
  },
  'wiener-neujahrskonzert': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/2/20/The_New_Years_Eve_Concert_2013_at_The_Wiener_Musikverein_%288336464777%29.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/5/59/Musikverein_Goldener_Saal.jpg',
      null,
      null,
    ],
  },
  'wiener-festwochen': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Wiener_Festwochen_6126.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/f/f5/Wiener_Festwochen_2018_Er%C3%B6ffnung_031_Mira_Lu_Kovacs.jpg',
      null,
      null,
    ],
  },
  'vienna-city-marathon': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Vienna_City_Marathon_2022_1.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/0/05/Vienna_City_Marathon_2022_4.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/f/f7/Vienna_City_Marathon_2015_-_Reichsbr%C3%BCcke_%281%29.JPG',
      null,
    ],
  },
  'wiener-regenbogenparade': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Regenbogenparade_2013_Wien_%28292%29_%289049460113%29.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/6/6f/Regenbogenparade_2010_Wien_196_%284757365905%29.jpg',
      null,
      null,
    ],
  },
  'viennale': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Viennale_2009%2C_Badeschiff_%283%29.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/c/ca/Viennale_2018_Suspiria_14_Tilda_Swinton.jpg',
      null,
      null,
    ],
  },
  'salzburger-festspiele': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Salzburger_Festspiele_2012_-_Jedermann.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/9/96/Salzburger_Festspiele_2012_-_Die_Zauberfl%C3%B6te.jpg',
      null,
      null,
    ],
  },
  'salzburger-christkindlmarkt': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Salzburg_-_Residenzplatz_Christkindlmarkt_-_2016_11_21_-_1.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/c/c5/Salzburg_-_Altstadt_-_Christkindlmarkt_-_2021_12_05-6.jpg',
      null,
      null,
    ],
  },
  'hahnenkamm-rennen-kitzbuehel': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Hahnekammrennen2011.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/f/fb/Kitzbuehel_slalom_ganslernhang_2010.jpg',
      null,
      null,
    ],
  },
  'innsbruck-christkindlmarkt': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Christkindlmarkt_Innsbruck_Altstadt.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/0/02/Christkindlmarkt_Innsbruck_Kiachl.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/f/fb/Christkindlmarkt_Innsbruck_Stiftskeller_01.jpg',
      null,
    ],
  },
  'snowbombing-mayrhofen': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Snowbombing.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/8/8e/Snowbombing_Street_Party.jpg',
      null,
      null,
    ],
  },
  'europaeisches-forum-alpbach': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Congresscentrum_Alpbach.JPG',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/1/18/CatherineAshton_EuropeanForumAlpbach_Austria_2014.jpg',
      null,
      null,
    ],
  },
  'linz-pflasterspektakel': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Linzer_Pflasterspektakel_2023_48.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/0/0a/Pflasterspektakel_Linz_Akrobat.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/7/7d/Street_performer_in_Linz_during_the_Pflasterspektakel_festival_%288166689926%29.jpg',
      null,
    ],
  },
  'linzer-klangwolke': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Linzer_Klangwolke_2024_BHO-2629.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/0/00/Klangwolke_2014_%2815160687505%29.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/4/45/Linzer_Klangwolke_2024_BHO-2474.jpg',
      null,
    ],
  },
  'linzer-christkindlmarkt': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Christkindlmarkt_Linz_Hauptplatz_%281%29.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/c/c8/Christkindlmarkt_Linz_Hauptplatz_%282%29.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/9/9a/Christkindlmarkt_Linz_Domplatz_%281%29.jpg',
      null,
    ],
  },
  'ars-electronica-festival': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Ars_Electronica_Center_in_Linz%2C_Austria.jpg',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/2/20/Ars_Electronica_Festival_2013_Tabakfabrik_Linz_05.jpg',
      null,
      null,
    ],
  },
  'bregenz-festspiele': {
    hero: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Seeb%C3%BChne_Bregenz_au%C3%9Fen.JPG',
    gallery: [
      'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bregenz-info_2025-Bregenzer_Festspiele-01ASD.jpg',
      null,
      null,
    ],
  },
};

async function processSlug(slug, data) {
  const slugDir = path.join(PUBLIC_DIR, slug);
  fs.mkdirSync(slugDir, { recursive: true });

  const slots = ['hero', 'gallery-1', 'gallery-2', 'gallery-3'];
  const urls = [data.hero, ...(data.gallery || [null, null, null])];
  const results = [];

  for (let i = 0; i < Math.min(slots.length, urls.length); i++) {
    const url = urls[i];
    const dest = path.join(slugDir, `${slots[i]}.jpg`);
    if (!url) { results.push(`${slots[i]}: skipped`); continue; }
    try {
      await downloadFile(url, dest);
      results.push(`${slots[i]}: ✓`);
    } catch (e) {
      results.push(`${slots[i]}: FAIL (${e.message.substring(0, 60)})`);
    }
  }
  console.log(`${slug}: ${results.join(' | ')}`);
}

async function main() {
  const slugs = Object.keys(WIKIMEDIA_IMAGES);
  console.log(`Downloading Wikimedia Commons images for ${slugs.length} posts...\n`);

  // Process in batches of 4
  const BATCH = 4;
  for (let i = 0; i < slugs.length; i += BATCH) {
    const batch = slugs.slice(i, i + BATCH);
    await Promise.all(batch.map(slug => processSlug(slug, WIKIMEDIA_IMAGES[slug])));
  }
  console.log('\nDone!');
}

main().catch(console.error);
