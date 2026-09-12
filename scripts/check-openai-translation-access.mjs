/** Small billed access check. Uses the existing key in place; never prints it.
 * No database writes, cron changes or balance/top-up operations.
 */
const apiKey = process.env.OPENAI_API_KEY;
const model = 'gpt-5.6-luna';
console.log(JSON.stringify({
  check: 'openai-translation-access', model,
  keyPresent: Boolean(apiKey),
  databaseConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
}));
if (!apiKey) {
  console.error('OPENAI_API_KEY is not configured in this runtime.');
  process.exit(2);
}

try {
  const started = Date.now();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model, store: false, reasoning: { effort: 'none' },
      instructions: 'Translate this Austrian event listing from German to natural English. Preserve names, times and prices. Do not add or omit facts.',
      input: 'Titel: Weinfest am Hauptplatz\nBeschreibung: Beginn um 18:30 Uhr. Eintritt: 8 Euro. Kinder unter 12 Jahren frei.',
      max_output_tokens: 256,
      text: { format: {
        type: 'json_schema', name: 'event_translation', strict: true,
        schema: {
          type: 'object', additionalProperties: false,
          properties: { title_en: { type: 'string' }, description_en: { type: 'string' } },
          required: ['title_en', 'description_en'],
        },
      } },
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    // Only structured status codes: provider messages can contain key fragments.
    console.error(JSON.stringify({
      ok: false, httpStatus: response.status,
      code: result.error?.code, type: result.error?.type,
      requestId: response.headers.get('x-request-id'),
    }));
    process.exit(1);
  }
  const text = (result.output ?? []).flatMap(item => item.content ?? [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('');
  const translated = JSON.parse(text);
  if (result.status !== 'completed' || !translated.title_en?.trim() || !translated.description_en?.trim()) {
    throw new Error('Incomplete translation response');
  }
  console.log(JSON.stringify({
    ok: true, model: result.model, latencyMs: Date.now() - started,
    usage: result.usage, translation: translated,
    note: 'Successful billed request; this does not reveal the remaining balance.',
  }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.name }));
  process.exit(1);
}
