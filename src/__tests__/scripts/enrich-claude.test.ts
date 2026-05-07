/**
 * Unit tests for the pure helpers in src/scripts/enrich-claude.ts.
 *
 * Side-effecting parts (main, callClaudeBatch, processBatch) are not
 * covered here — they need a live `claude` binary + Supabase env. Smoke
 * coverage of those happens via `npm run enrich:claude -- --limit N
 * --dry-run` against the real DB.
 *
 * What IS tested here:
 *   - descOverridePolicy: the fn-14.3 description-override matrix
 *   - parseSince: --since=24h / 7d / 30m parsing
 *   - buildSystemPrompt: anti-bleed rule + price-edge-cases + 3 new flags
 *     are present in the prompt body, AND the prompt is built FROM code
 *     constants (no hardcoded vocabulary drift).
 */
import { describe, it, expect } from 'vitest';
import {
  descOverridePolicy,
  parseSince,
  buildSystemPrompt,
  MODEL_MAP,
  ENRICHMENT_VERSION_CLAUDE_V1,
  AuthError,
  SchemaMismatchError,
  totalQuotaTokens,
  getArg,
} from '@/scripts/enrich-claude';
import {
  PRIMARY_CATEGORIES,
  PRICE_FLAGS,
  TAGS,
} from '@/lib/category-classifier/enrichment-taxonomy';

describe('descOverridePolicy — fn-14.3 description override matrix', () => {
  it('returns "fill" for null/empty', () => {
    expect(descOverridePolicy(null).policy).toBe('fill');
    expect(descOverridePolicy('').policy).toBe('fill');
    expect(descOverridePolicy('   ').policy).toBe('fill');
  });

  it('returns "fill" for very short (< 40 chars)', () => {
    expect(descOverridePolicy('Konzert in Wien.').policy).toBe('fill');
    expect(descOverridePolicy('A'.repeat(39)).policy).toBe('fill');
  });

  it('returns "polish" for short non-empty (40..399)', () => {
    expect(descOverridePolicy('A'.repeat(40)).policy).toBe('polish');
    expect(descOverridePolicy('A'.repeat(399)).policy).toBe('polish');
  });

  it('returns "leave" for long & clean (≥ 400 chars, no HTML)', () => {
    expect(descOverridePolicy('A'.repeat(400)).policy).toBe('leave');
    expect(descOverridePolicy('A'.repeat(1000)).policy).toBe('leave');
  });

  it('returns "polish" for long-but-HTML-tainted', () => {
    const html = '<p>' + 'A'.repeat(500) + '</p>';
    expect(descOverridePolicy(html).policy).toBe('polish');
  });

  it('returns "polish" for long-with-inline-tags', () => {
    const desc = 'A'.repeat(450) + ' <a href="x">link</a> more text';
    expect(descOverridePolicy(desc).policy).toBe('polish');
  });
});

describe('parseSince — --since=N{s|m|h|d}', () => {
  it('parses seconds', () => {
    expect(parseSince('30s')).toBe(30_000);
  });
  it('parses minutes', () => {
    expect(parseSince('15m')).toBe(15 * 60_000);
  });
  it('parses hours', () => {
    expect(parseSince('24h')).toBe(24 * 3_600_000);
  });
  it('parses days', () => {
    expect(parseSince('7d')).toBe(7 * 86_400_000);
  });
  it('returns null for null/empty', () => {
    expect(parseSince(null)).toBeNull();
    expect(parseSince('')).toBeNull();
  });
  it('returns null for malformed', () => {
    expect(parseSince('abc')).toBeNull();
    expect(parseSince('-1h')).toBeNull();
    expect(parseSince('2y')).toBeNull();
  });
  it('handles whitespace', () => {
    expect(parseSince('  24h  ')).toBe(24 * 3_600_000);
  });
});

describe('buildSystemPrompt — generated from code constants', () => {
  const prompt = buildSystemPrompt();

  it('contains the anti-bleed rule', () => {
    expect(prompt).toMatch(/ANTI-BLEED/i);
    expect(prompt).toMatch(/Erwähne in der Beschreibung NIE die Kategorie/i);
  });

  it('contains the 3 fn-14.3 boolean facets', () => {
    expect(prompt).toMatch(/is_dog_friendly/);
    expect(prompt).toMatch(/is_wheelchair_accessible/);
    expect(prompt).toMatch(/is_outdoor/);
  });

  it('contains description length envelope (400-1000)', () => {
    expect(prompt).toMatch(/400.*1000.*Zeichen/);
  });

  it('contains all 3 fn-14.3 price-edge-cases', () => {
    expect(prompt).toMatch(/ab 25.*25/);
    expect(prompt).toMatch(/Spende erbeten/);
    expect(prompt).toMatch(/spende-erbeten/);
    expect(prompt).toMatch(/Erwachsene 15/);
  });

  it('embeds primary_category vocabulary from code', () => {
    for (const cat of PRIMARY_CATEGORIES) {
      expect(prompt).toContain(cat);
    }
  });

  it('embeds price_flags vocabulary from code (incl. new spende-erbeten)', () => {
    expect(prompt).toContain('spende-erbeten');
    for (const flag of PRICE_FLAGS) {
      expect(prompt).toContain(flag);
    }
  });

  it('embeds activity TAGS from code (sample)', () => {
    // Spot-check: the prompt should list tags. Sample 5 random tags.
    const sample = ['klassik', 'pop', 'techno', 'wandern', 'pub-quiz'];
    for (const tag of sample) {
      if (TAGS.includes(tag as typeof TAGS[number])) {
        expect(prompt).toContain(tag);
      }
    }
  });

  it('mentions the suggested_price_min field with EUR semantics', () => {
    expect(prompt).toMatch(/suggested_price_min/);
    expect(prompt).toMatch(/EUR/);
  });

  it('mentions the narrative description style', () => {
    expect(prompt).toMatch(/erzählend|ERZÄHLEND/i);
  });

  it('mentions the verifiable-facts vs personalities rule', () => {
    expect(prompt).toMatch(/Venues|VENUES/);
    expect(prompt).toMatch(/Personen|PERSONEN/);
  });
});

describe('MODEL_MAP — fn-14.3 model IDs', () => {
  it('maps sonnet to claude-sonnet-4-6', () => {
    expect(MODEL_MAP.sonnet).toBe('claude-sonnet-4-6');
  });
  it('maps opus to claude-opus-4-7', () => {
    expect(MODEL_MAP.opus).toBe('claude-opus-4-7');
  });
});

describe('ENRICHMENT_VERSION_CLAUDE_V1', () => {
  it('is "claude-v1"', () => {
    expect(ENRICHMENT_VERSION_CLAUDE_V1).toBe('claude-v1');
  });
});

describe('getArg — supports both --flag value and --flag=value forms', () => {
  it('parses split form: --flag value', () => {
    expect(getArg(['--since', '24h'], '--since')).toBe('24h');
  });

  it('parses joined form: --flag=value', () => {
    expect(getArg(['--since=24h'], '--since')).toBe('24h');
  });

  it('parses joined form even when value contains "="', () => {
    expect(getArg(['--alert-email=foo=bar@example.com'], '--alert-email')).toBe('foo=bar@example.com');
  });

  it('does NOT consume next arg if it starts with --', () => {
    // --since followed by --dry-run: the latter is its own flag.
    expect(getArg(['--since', '--dry-run'], '--since')).toBeUndefined();
  });

  it('returns undefined for missing flag', () => {
    expect(getArg(['--limit', '10'], '--since')).toBeUndefined();
  });

  it('supports alias (alt) flag', () => {
    expect(getArg(['--max-events', '50'], '--limit', '--max-events')).toBe('50');
    expect(getArg(['--max-events=50'], '--limit', '--max-events')).toBe('50');
  });

  it('prefers primary flag over alt', () => {
    expect(getArg(['--max-events', '99', '--limit', '10'], '--limit', '--max-events')).toBe('10');
  });

  it('ignores --flagsuffix that aren\'t the requested flag', () => {
    // --batch-sizer must NOT match --batch-size
    expect(getArg(['--batch-sizer=99'], '--batch-size')).toBeUndefined();
  });
});

describe('totalQuotaTokens — quota counts include cache tokens', () => {
  it('sums all four token counters', () => {
    expect(totalQuotaTokens({
      tokensIn: 1000,
      tokensOut: 200,
      cacheReadIn: 5000,
      cacheCreateIn: 40000,
    })).toBe(46200);
  });

  it('returns 0 for an all-zero stats snapshot', () => {
    expect(totalQuotaTokens({
      tokensIn: 0, tokensOut: 0, cacheReadIn: 0, cacheCreateIn: 0,
    })).toBe(0);
  });

  it('does NOT undercount when cache_creation dominates (taxonomy-heavy first call)', () => {
    // First call typically has tokensIn ~ small + cacheCreate ~ huge.
    // Old behavior (in+out only) reported 800 of 800,000 budget = 0.1%.
    // New behavior reports 800 + 800 + 0 + 800,000 = 801,600 of 800,000 = 100%.
    const s = { tokensIn: 800, tokensOut: 800, cacheReadIn: 0, cacheCreateIn: 800_000 };
    expect(totalQuotaTokens(s)).toBeGreaterThanOrEqual(800_000);
  });
});

describe('error classes — distinct types for distinct bail-out paths', () => {
  it('AuthError is exported and instanceof Error', () => {
    const e = new AuthError('not logged in');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(AuthError);
    expect(e.name).toBe('AuthError');
    expect(e.message).toBe('not logged in');
  });

  it('SchemaMismatchError is exported and distinct from AuthError', () => {
    const e = new SchemaMismatchError('column does not exist');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(SchemaMismatchError);
    expect(e).not.toBeInstanceOf(AuthError);
    expect(e.name).toBe('SchemaMismatchError');
  });
});
