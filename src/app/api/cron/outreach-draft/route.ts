import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { buildDraftPrompt, COMPLIANCE_FOOTER, type DraftInput } from '@/lib/outreach/draft-prompt';
import type { ListedEvent } from '@/lib/outreach/link-events';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PER_RUN = 20;
const MODEL = 'gpt-4o-mini';

export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY missing' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // enriched = not yet drafted (drafting flips status to 'drafted').
  const { data: prospects } = await supabase
    .from('outreach_prospects')
    .select('id, domain, org_name, bundesland, personalization')
    .eq('status', 'enriched')
    .order('updated_at', { ascending: true })
    .limit(PER_RUN);

  let drafted = 0;
  for (const p of (prospects ?? []) as Array<{
    id: string; domain: string; org_name: string | null; bundesland: string | null;
    personalization: { events?: ListedEvent[] } | null;
  }>) {
    const input: DraftInput = {
      orgName: p.org_name,
      domain: p.domain,
      bundesland: p.bundesland,
      events: p.personalization?.events ?? [],
    };
    try {
      const res = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: buildDraftPrompt(input) }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });
      const raw = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { subject?: string; body?: string };
      if (!parsed.subject || !parsed.body) continue;

      await supabase.from('outreach_drafts').insert({
        prospect_id: p.id,
        subject: parsed.subject.trim(),
        body: parsed.body.trim() + COMPLIANCE_FOOTER,
        model: MODEL,
      });
      await supabase.from('outreach_prospects')
        .update({ status: 'drafted', updated_at: new Date().toISOString() })
        .eq('id', p.id);
      drafted += 1;
    } catch {
      // API/parse error — leave as enriched for next run.
    }
  }

  return NextResponse.json({ ok: true, processed: prospects?.length ?? 0, drafted });
}
