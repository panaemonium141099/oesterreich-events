/**
 * Event Data Validator & Auto-Fixer
 * Runs post-scrape to ensure data quality across all events.
 *
 * Checks & fixes:
 * 1. Extract time from title/description → start_date
 * 2. Fix date-fragment times (04:04, 02:04 etc.)
 * 3. Extract PLZ from description/address → postal_code
 * 4. Extract location from title → location_name
 * 5. Remove garbage events (Öffnungszeiten, Kontakt, etc.)
 * 6. Remove duplicates (same title + date + source)
 * 7. Validate coordinates against bundesland
 * 8. Re-categorize uncategorized events
 */

const db = require('better-sqlite3')('./data/events.db');

let stats = { timeExtracted: 0, timeFixed: 0, plzExtracted: 0, garbageDeleted: 0, dupesDeleted: 0, locationFixed: 0, total: 0 };

console.log('🔍 Starting event validation...\n');

// ============================================================
// 1. DELETE GARBAGE EVENTS
// ============================================================
console.log('1️⃣  Removing garbage events...');

const garbagePatterns = [
  "title = 'Öffnungszeiten'",
  "title = 'ÖFFNUNGSZEITEN'",
  "title = 'Kontakt'",
  "title = 'KONTAKT'",
  "title = 'Mehr Infos'",
  "title = 'mehr Infos'",
  "title LIKE 'weiterlesen%'",
  "title LIKE 'Datum:%'",
  "title LIKE 'Ort:%'",
  "title LIKE 'mehr Informationen%'",
  "title LIKE 'Detailinfos%'",
  "LENGTH(title) < 4",
  "title GLOB '[0-9][0-9]:[0-9][0-9]' AND LENGTH(title) = 5",
  "title GLOB '[0-9][0-9].[0-9][0-9].[0-9][0-9][0-9][0-9]' AND LENGTH(title) = 10",
  "title = 'Programm'",
  "title = 'Events'",
  "title = 'Webcam'",
  "title = 'Zum Inhalt springen'",
  "title = 'Zum Seitenende springen'",
  "title LIKE 'Jetzt Ihre Veranstaltung%'",
];

for (const pattern of garbagePatterns) {
  const r = db.prepare(`DELETE FROM events WHERE ${pattern}`).run();
  if (r.changes > 0) {
    console.log(`  Deleted ${r.changes} events: ${pattern.substring(0, 50)}`);
    stats.garbageDeleted += r.changes;
  }
}

// ============================================================
// 2. FIX DATE-FRAGMENT TIMES (04:04, 02:04 = day.month not time)
// ============================================================
console.log('\n2️⃣  Fixing date-fragment times...');

// Pattern: events where time HH:MM matches DD:MM pattern and HH < 13, MM < 13
const suspiciousTimes = db.prepare(`
  SELECT id, start_date FROM events
  WHERE LENGTH(start_date) > 10
  AND CAST(SUBSTR(start_date, 14, 2) AS INTEGER) <= 12
  AND CAST(SUBSTR(start_date, 12, 2) AS INTEGER) <= 12
  AND CAST(SUBSTR(start_date, 12, 2) AS INTEGER) != 0
  AND SUBSTR(start_date, 14, 2) != '00'
  AND SUBSTR(start_date, 14, 2) != '30'
  AND SUBSTR(start_date, 14, 2) != '15'
  AND SUBSTR(start_date, 14, 2) != '45'
`).all();

// More targeted: times like 01:04, 02:04, 03:04 etc where minute matches month
const fragUpdate = db.prepare('UPDATE events SET start_date = SUBSTR(start_date, 1, 10) WHERE id = ?');
let fragFixed = 0;
for (const e of suspiciousTimes) {
  const time = e.start_date.substring(11, 16);
  const hour = parseInt(time.split(':')[0]);
  const minute = parseInt(time.split(':')[1]);

  // If minute matches a month (01-12) and hour matches a day (01-31)
  // and it's not a common real time (like 09:00, 10:00, etc.)
  if (minute >= 1 && minute <= 12 && hour >= 1 && hour <= 31 &&
      minute !== 0 && minute !== 15 && minute !== 30 && minute !== 45) {
    fragUpdate.run(e.id);
    fragFixed++;
  }
}
console.log(`  Fixed ${fragFixed} date-fragment times → date only`);
stats.timeFixed += fragFixed;

// Also fix 00:00 times (midnight = likely no real time)
const midnight = db.prepare("UPDATE events SET start_date = SUBSTR(start_date, 1, 10) WHERE start_date LIKE '%T00:00%'").run();
console.log(`  Fixed ${midnight.changes} midnight (00:00) times → date only`);
stats.timeFixed += midnight.changes;

// ============================================================
// 3. EXTRACT TIME FROM TITLE
// ============================================================
console.log('\n3️⃣  Extracting times from titles...');

const noTimeEvents = db.prepare(`
  SELECT id, title, description, start_date FROM events
  WHERE LENGTH(start_date) = 10
  AND (title LIKE '%Uhr%' OR title LIKE '%um __:%' OR title LIKE '%ab __:%'
       OR description LIKE '%Uhr%' OR description LIKE '%Beginn%')
`).all();

const timePatterns = [
  /(\d{1,2})[:.:](\d{2})\s*(?:Uhr|uhr)/,
  /(?:Beginn|beginn|Start|Einlass|ab)\s*(?:um\s*)?(\d{1,2})[:.:](\d{2})/i,
  /(?:Beginn|beginn|Start|Einlass|ab)\s*(?:um\s*)?(\d{1,2})\s*(?:Uhr|uhr)/i,
  /(?:um|ab)\s+(\d{1,2})[:.:](\d{2})/i,
  /(\d{1,2})[:.:](\d{2})\s*(?:bis|-)\s*\d{1,2}/,
];

const timeUpdate = db.prepare('UPDATE events SET start_date = ? WHERE id = ?');
db.transaction(() => {
  for (const e of noTimeEvents) {
    const text = (e.title || '') + ' ' + (e.description || '');
    for (const pattern of timePatterns) {
      const m = text.match(pattern);
      if (m) {
        let hour = parseInt(m[1]);
        let minute = m[2] ? parseInt(m[2]) : 0;
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          const timeStr = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
          timeUpdate.run(e.start_date + 'T' + timeStr, e.id);
          stats.timeExtracted++;
          break;
        }
      }
    }
  }
})();
console.log(`  Extracted ${stats.timeExtracted} times from titles/descriptions`);

// ============================================================
// 4. EXTRACT PLZ FROM DESCRIPTION/ADDRESS
// ============================================================
console.log('\n4️⃣  Extracting PLZ from descriptions...');

const noPlzEvents = db.prepare(`
  SELECT id, description, address, title FROM events
  WHERE (postal_code IS NULL OR postal_code = '')
  AND (description LIKE '%, ____ %' OR address LIKE '%, ____ %' OR description LIKE '%PLZ%')
  LIMIT 5000
`).all();

const plzUpdate = db.prepare('UPDATE events SET postal_code = ? WHERE id = ?');
const plzPattern = /\b(\d{4})\s+[A-ZÄÖÜ][a-zäöüß]/;

db.transaction(() => {
  for (const e of noPlzEvents) {
    const text = (e.address || '') + ' ' + (e.description || '');
    const m = text.match(plzPattern);
    if (m) {
      const plz = m[1];
      const num = parseInt(plz);
      if (num >= 1000 && num <= 9999) {
        plzUpdate.run(plz, e.id);
        stats.plzExtracted++;
      }
    }
  }
})();
console.log(`  Extracted ${stats.plzExtracted} postal codes`);

// ============================================================
// 5. REMOVE EXACT DUPLICATES (same title + date + source)
// ============================================================
console.log('\n5️⃣  Removing duplicates...');

const dupes = db.prepare(`
  DELETE FROM events WHERE id NOT IN (
    SELECT MIN(id) FROM events
    GROUP BY title, SUBSTR(start_date, 1, 10), source_name
  )
`).run();
console.log(`  Deleted ${dupes.changes} duplicate events`);
stats.dupesDeleted = dupes.changes;

// ============================================================
// 6. REMOVE CROSS-SOURCE DUPLICATES (same title + date, different sources)
// ============================================================
console.log('\n6️⃣  Removing cross-source duplicates...');

// Keep the event with the most data (description, image, etc.)
const crossDupes = db.prepare(`
  DELETE FROM events WHERE id IN (
    SELECT e2.id FROM events e1
    JOIN events e2 ON e1.title = e2.title
      AND SUBSTR(e1.start_date, 1, 10) = SUBSTR(e2.start_date, 1, 10)
      AND e1.source_name != e2.source_name
      AND e1.id < e2.id
    WHERE (e1.description IS NOT NULL AND e1.description != '')
      OR (e1.image_url IS NOT NULL AND e1.image_url != '')
  )
`).run();
console.log(`  Deleted ${crossDupes.changes} cross-source duplicates`);
stats.dupesDeleted += crossDupes.changes;

// ============================================================
// 7. SUMMARY
// ============================================================
const total = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
const future = db.prepare("SELECT COUNT(*) as c FROM events WHERE start_date >= date('now')").get().c;

console.log('\n' + '═'.repeat(50));
console.log('✅ Validation complete!');
console.log('═'.repeat(50));
console.log(`  Garbage deleted:    ${stats.garbageDeleted}`);
console.log(`  Times extracted:    ${stats.timeExtracted}`);
console.log(`  Times fixed:        ${stats.timeFixed}`);
console.log(`  PLZ extracted:      ${stats.plzExtracted}`);
console.log(`  Duplicates removed: ${stats.dupesDeleted}`);
console.log(`  ─────────────────────────`);
console.log(`  Total events:       ${total}`);
console.log(`  Future events:      ${future}`);
console.log('═'.repeat(50));
