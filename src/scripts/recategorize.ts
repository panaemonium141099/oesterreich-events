/**
 * Re-run category assignment for all events using the updated categorizeEvent function.
 * Run with: npx tsx src/scripts/recategorize.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { categorizeEvent } from '../lib/categories';

const DB_PATH = path.join(process.cwd(), 'data', 'events.db');
const db = new Database(DB_PATH);

interface EventRow { id: number; title: string; description: string | null; tags: string | null; category: string | null; }
// Only update Sonstiges events - preserves enriched categories from scrapers
const events = db.prepare("SELECT id, title, description, tags, category FROM events WHERE category = 'Sonstiges' OR category IS NULL").all() as EventRow[];

console.log(`Re-categorizing ${events.length} events...`);

const update = db.prepare('UPDATE events SET category = ? WHERE id = ?');
const counts: Record<string, number> = {};
let changed = 0;

for (const event of events) {
  const tags = event.tags ? JSON.parse(event.tags) : undefined;
  const newCategory = categorizeEvent(event.title, event.description || undefined, tags);
  update.run(newCategory, event.id);
  counts[newCategory] = (counts[newCategory] || 0) + 1;
  changed++;
}

db.close();

console.log(`\nDone! Updated ${changed} events.`);
console.log('Category distribution:');
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
  console.log(`  ${cat}: ${cnt}`);
});
