/** Bounded, read-only comparison with stored Gemini-era translations.
 * Run inside nextjs-app with its existing OpenAI key. Only public fixtures; no database access.
 * Exactly 100 requests maximum, no retries, two workers, < 1 USD output cap.
 */
const model = 'gpt-5.6-luna';
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('OPENAI_API_KEY is missing');
console.log(JSON.stringify({ check: 'report-recipient',
  alertRecipientMatchesProjectOwner: process.env.ALERT_EMAIL === 'jona.glatz@gmail.com',
  alertEmailConfigured: Boolean(process.env.ALERT_EMAIL),
  brevoConfigured: Boolean(process.env.BREVO_API_KEY), resendConfigured: Boolean(process.env.RESEND_API_KEY) }));
const rules = `- Keep proper nouns unchanged: venue names, band/artist names, place names (Gemeinde/city names), festival brand names. "Heuriger"/"Kirtag" may be kept with a short English gloss on first use, e.g. "Kirtag (traditional fair)".
- Translate faithfully — do NOT add, embellish or omit information. No marketing language that is not in the source.
- title_en: concise translated title. If the title is a proper name that needs no translation, return it unchanged.`;
const eventFull = `You translate Austrian event listings from German to natural English for an event-discovery website.

Rules:
${rules}
- Keep the original paragraph/line-break structure of the description.
- description_en: full translation of the description.`;
const eventTitle = `You translate Austrian event titles from German to natural English for an event-discovery website.

Rules:
${rules}
- Return only the translated title, nothing else.`;
const activityPrompt = `You translate descriptions of Austrian leisure destinations (museums, pools, castles, hiking areas, thermal baths, viewpoints) from German to natural English for a travel-and-events website.

Rules:
- Keep proper nouns unchanged: the name of the destination itself, place names, mountain and lake names, operator and brand names.
- Translate faithfully — do NOT add, embellish or omit information. No marketing language that is not in the source.
- Keep the original paragraph and line-break structure.
- Convert nothing: prices, opening hours, distances and altitudes stay exactly as written.
- Austrian terms without an English equivalent may keep the German word with a short gloss on first use, e.g. "Alm (mountain pasture)", "Heuriger (wine tavern)".
- description_en: the full translation. Return nothing else.`;

// Supplied by the workflow from a checked-in fixture collected without authentication.
// No database client, service-role key or private database reads are used here.
const samples = PUBLIC_TRANSLATION_SAMPLES.samples;
if (samples.length !== 100 || samples.some(row => !row.publicSourceUrl?.startsWith('https://lasstreffen.at/'))) {
  throw new Error('Expected exactly 100 publicly sourced samples');
}
console.log(JSON.stringify({check:'sample', total:samples.length, titles:20, eventDescriptions:60, activities:20,
  provenance: PUBLIC_TRANSLATION_SAMPLES.provenance,
  baseline:'Stored public translations; Gemini unavailable, no fresh Gemini requests'}));
let next = 0, failed = 0, inputTokens = 0, outputTokens = 0, cachedTokens = 0, cacheWriteTokens = 0;
const latencies = [];
const numbers = text => [...new Set((text.match(/\d+(?:[.,:]\d+)*/g) || []).map(s=>s.replace(/[.,:]/g,'')))];
async function worker() {
  while (next < samples.length && !failed) {
    const index = next++, row = samples[index], activity = row.kind === 'activity';
    const description = row.kind === 'event_title' ? null : row.description.slice(0, activity ? 6000 : 4000);
    const fields = activity ? ['description_en'] : description ? ['title_en','description_en'] : ['title_en'];
    const schema = {type:'object', additionalProperties:false, properties:Object.fromEntries(fields.map(k=>[k,{type:'string'}])), required:fields};
    const started = Date.now();
    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, signal:AbortSignal.timeout(30_000),
      body:JSON.stringify({ model,store:false,reasoning:{effort:'none'},
        instructions:activity ? activityPrompt : description ? eventFull : eventTitle,
        input:activity ? `Name: ${row.name}\n\nBeschreibung:\n${description}` : description ? `Titel: ${row.title}\n\nBeschreibung:\n${description}` : `Titel: ${row.title}`,
        max_output_tokens:activity ? 6144 : description ? 4096 : 256,
        text:{format:{type:'json_schema',name:'translation',strict:true,schema}},
      }),
    });
    const response = await r.json();
    if (!r.ok) { failed++; console.log(JSON.stringify({index,ok:false,status:r.status,code:response.error?.code,type:response.error?.type})); return; }
    const text = (response.output || []).flatMap(x=>x.content || []).filter(x=>x.type==='output_text').map(x=>x.text).join('');
    let result;
    try { result = JSON.parse(text); } catch { failed++; throw new Error(`Invalid JSON at ${index}`); }
    if (response.status !== 'completed' || fields.some(f=>typeof result[f]!=='string' || !result[f].trim())) { failed++; throw new Error(`Incomplete output at ${index}`); }
    const ms = Date.now()-started; latencies.push(ms);
    inputTokens += response.usage.input_tokens; outputTokens += response.usage.output_tokens;
    cachedTokens += response.usage.input_tokens_details?.cached_tokens || 0;
    cacheWriteTokens += response.usage.input_tokens_details?.cache_write_tokens || 0;
    const source = `${row.title || row.name}\n${description || ''}`, translated = `${result.title_en || row.name}\n${result.description_en || ''}`;
    const missingNumbers = numbers(source).filter(n=>!numbers(translated).includes(n));
    console.log('TRANSLATION_SAMPLE '+JSON.stringify({index,kind:row.kind,id:row.id,sourceName:row.source_name,category:row.category,publicSourceUrl:row.publicSourceUrl,publicBaselineUrl:row.publicBaselineUrl,
      source:{title:row.title || row.name,description}, baseline:{title_en:row.title_en,description_en:row.description_en}, result,
      missingNumbers,latencyMs:ms,usage:response.usage }));
  }
}
await Promise.all([worker(),worker()]);
latencies.sort((a,b)=>a-b);
console.log('TRANSLATION_SUMMARY '+JSON.stringify({model,requested:100,completed:latencies.length,failed,inputTokens,outputTokens,cachedTokens,cacheWriteTokens,
  estimatedUsd:((inputTokens-cachedTokens-cacheWriteTokens)*0.2+cachedTokens*0.02+cacheWriteTokens*0.25+outputTokens*1.2)/1e6,
  medianMs:latencies[Math.floor(latencies.length/2)],p95Ms:latencies[Math.floor(latencies.length*0.95)]}));
if (failed || latencies.length!==100) process.exit(1);
