/**
 * Event scoring script: calculates quality/relevance scores for future events.
 *
 * Score formula (0-100, clamped):
 *  - Image present (non-empty):               +15
 *  - Description > 50 chars:                  +10
 *  - Description > 200 chars (extra):          +5
 *  - ticket_url present:                      +15
 *  - price_min > 0 OR price_text non-empty:    +5
 *  - price_min > 20 (extra):                   +5
 *  - tags array non-empty:                     +5
 *  - organizer non-empty:                      +5
 *  - source_url present:                       +5
 *  - Engagement (views*0.5 + saves*2 + shares*3, max 20): up to +20
 *  - Time bonus: next 7 days +10, 8-30 days +5
 *
 * Run with: npm run score
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH_SIZE = 1000;

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_text: string | null;
  tags: string[] | null;
  organizer: string | null;
  source_url: string | null;
  view_count: number;
  save_count: number;
  share_count: number;
  start_date: string;
}

function calculateScore(event: EventRow): number {
  let score = 0;

  // Image present
  if (event.image_url && event.image_url.trim().length > 0) {
    score += 15;
  }

  // Description length bonuses
  const descLen = event.description ? event.description.trim().length : 0;
  if (descLen > 50) score += 10;
  if (descLen > 200) score += 5;

  // Ticket URL
  if (event.ticket_url && event.ticket_url.trim().length > 0) {
    score += 15;
  }

  // Price signals
  const hasPriceMin = event.price_min !== null && event.price_min > 0;
  const hasPriceText = event.price_text !== null && event.price_text.trim().length > 0;
  if (hasPriceMin || hasPriceText) {
    score += 5;
    if (hasPriceMin && event.price_min! > 20) {
      score += 5;
    }
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    score += 5;
  }

  // Organizer
  if (event.organizer && event.organizer.trim().length > 0) {
    score += 5;
  }

  // Source URL
  if (event.source_url && event.source_url.trim().length > 0) {
    score += 5;
  }

  // Engagement score (max 20)
  const engagementScore = Math.min(
    event.view_count * 0.5 + event.save_count * 2 + event.share_count * 3,
    20
  );
  score += engagementScore;

  // Time bonus
  const now = new Date();
  const startDate = new Date(event.start_date);
  const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil >= 0 && daysUntil <= 7) {
    score += 10;
  } else if (daysUntil >= 8 && daysUntil <= 30) {
    score += 5;
  }

  // Clamp to 0-100
  return Math.min(100, Math.max(0, score));
}

async function main() {
  console.log('Starting event score calculation...');

  const today = new Date().toISOString().slice(0, 10);

  // Fetch all future events
  let allEvents: EventRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, image_url, ticket_url, price_min, price_text, tags, organizer, source_url, view_count, save_count, share_count, start_date')
      .gte('start_date', today)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching events:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    allEvents = allEvents.concat(data as EventRow[]);
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  console.log(`Fetched ${allEvents.length} future events. Calculating scores...`);

  // Calculate scores
  const scored = allEvents.map(event => ({
    id: event.id,
    title: event.title,
    event_score: calculateScore(event),
    score_updated_at: new Date().toISOString(),
  }));

  // Batch update
  let updated = 0;
  for (let i = 0; i < scored.length; i += BATCH_SIZE) {
    const batch = scored.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('events')
      .upsert(
        batch.map(({ id, event_score, score_updated_at }) => ({
          id,
          event_score,
          score_updated_at,
        })),
        { onConflict: 'id' }
      );

    if (error) {
      console.error(`Error updating batch starting at ${i}:`, error);
      process.exit(1);
    }

    updated += batch.length;
    process.stdout.write(`\rUpdated ${updated}/${scored.length} events...`);
  }

  console.log(`\nScored ${scored.length} events.`);

  // Log top 10
  const top10 = scored
    .sort((a, b) => b.event_score - a.event_score)
    .slice(0, 10);

  console.log('\nTop 10 events by score:');
  top10.forEach((e, i) => {
    console.log(`  ${i + 1}. [${e.event_score.toFixed(1)}] ${e.title}`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
