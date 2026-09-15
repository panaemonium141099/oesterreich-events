import { describe, it, expect } from 'vitest';
import {
  activityDescriptionFromContent,
  buildActivityRequest,
  buildEventRequest,
  customId,
  estimateCostUsd,
  eventPatchFromContent,
  parseCustomId,
  parseOutputLine,
  qualityIssue,
  toJsonl,
} from '@/lib/i18n/openai-batch';
import { SYSTEM_FULL, SYSTEM_TITLE_ONLY } from '@/lib/i18n/translate-event';

/**
 * OpenAI-Batch-Übersetzung — das Format, nicht das Modell.
 *
 * Geprüft wird, was einen Batch still kaputt machen könnte: eine
 * JSONL-Zeile, die die API ablehnt; eine Antwort, die als Erfolg
 * durchgeht, obwohl sie abgeschnitten oder verweigert wurde; und die
 * Qualitätsprüfung, die untranslatierte Texte in die DB lassen würde.
 */

describe('buildEventRequest', () => {
  it('nutzt fuer Events mit Beschreibung den Voll-Prompt und beide Felder im Schema', () => {
    const line = buildEventRequest({ id: 'e1', title: 'Kirtag', description: 'Ein Fest.' }, 'gpt-4.1-nano');
    expect(line.custom_id).toBe('event:e1');
    expect(line.url).toBe('/v1/chat/completions');
    const body = line.body as { model: string; messages: Array<{ role: string; content: string }>; response_format: { json_schema: { strict: boolean; schema: { required: string[] } } }; max_completion_tokens: number; temperature: number };
    expect(body.model).toBe('gpt-4.1-nano');
    expect(body.messages[0]).toEqual({ role: 'system', content: SYSTEM_FULL });
    expect(body.messages[1].content).toBe('Titel: Kirtag\n\nBeschreibung:\nEin Fest.');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.required).toEqual(['title_en', 'description_en']);
    expect(body.temperature).toBe(0);
    expect(body.max_completion_tokens).toBe(4096);
  });

  it('nutzt ohne Beschreibung den Titel-Prompt mit kleinem Budget', () => {
    const line = buildEventRequest({ id: 'e2', title: 'Kirtag', description: '   ' }, 'gpt-4.1-nano');
    const body = line.body as { messages: Array<{ content: string }>; response_format: { json_schema: { schema: { required: string[] } } }; max_completion_tokens: number };
    expect(body.messages[0].content).toBe(SYSTEM_TITLE_ONLY);
    expect(body.messages[1].content).toBe('Titel: Kirtag');
    expect(body.response_format.json_schema.schema.required).toEqual(['title_en']);
    expect(body.max_completion_tokens).toBe(256);
  });

  it('kappt lange Beschreibungen auf das Input-Budget', () => {
    const line = buildEventRequest({ id: 'e3', title: 'T', description: 'x'.repeat(10_000) }, 'm');
    const body = line.body as { messages: Array<{ content: string }> };
    expect(body.messages[1].content.length).toBeLessThan(4100);
  });
});

describe('buildActivityRequest / toJsonl', () => {
  it('erzeugt eine Zeile je Anfrage ohne Zeilenumbrueche im JSON', () => {
    const lines = [
      buildActivityRequest({ id: 'p1', name: 'Freibad', description: 'Text\nmit Umbruch' }, 'm'),
      buildEventRequest({ id: 'e1', title: 'T', description: null }, 'm'),
    ];
    const jsonl = toJsonl(lines);
    const rows = jsonl.trim().split('\n');
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[0]).custom_id).toBe('poi:p1');
    expect(JSON.parse(rows[1]).custom_id).toBe('event:e1');
  });
});

describe('customId', () => {
  it('ist umkehrbar, auch bei Doppelpunkten in der id', () => {
    expect(parseCustomId(customId('event', 'a:b'))).toEqual({ kind: 'event', id: 'a:b' });
    expect(parseCustomId('poi:7')).toEqual({ kind: 'poi', id: '7' });
    expect(parseCustomId('venue:7')).toBeNull();
    expect(parseCustomId('event:')).toBeNull();
  });
});

describe('parseOutputLine', () => {
  const ok = (content: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      custom_id: 'event:1',
      response: {
        status_code: 200,
        body: {
          choices: [{ finish_reason: 'stop', message: { content, refusal: null }, ...extra }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        },
      },
      error: null,
    });

  it('liefert Inhalt und Tokenverbrauch einer gelungenen Antwort', () => {
    const line = parseOutputLine(ok('{"title_en":"Fair"}'));
    expect(line).toEqual({ customId: 'event:1', ok: true, content: '{"title_en":"Fair"}', usage: { input: 100, output: 20 } });
  });

  it('wertet abgeschnittene Antworten als Fehler — das JSON waere unvollstaendig', () => {
    const raw = JSON.parse(ok('{"title_en":"Fa'));
    raw.response.body.choices[0].finish_reason = 'length';
    const line = parseOutputLine(JSON.stringify(raw));
    expect(line?.ok).toBe(false);
    if (line && !line.ok) expect(line.reason).toMatch(/abgeschnitten/);
  });

  it('wertet eine Verweigerung als Fehler, auch bei HTTP 200', () => {
    const raw = JSON.parse(ok(''));
    raw.response.body.choices[0].message = { content: null, refusal: 'I cannot help with that.' };
    const line = parseOutputLine(JSON.stringify(raw));
    expect(line?.ok).toBe(false);
    if (line && !line.ok) expect(line.reason).toBe('Refusal');
  });

  it('liest die Fehlerdatei: HTTP-Fehler und nie bearbeitete Anfragen', () => {
    const http = parseOutputLine(JSON.stringify({
      custom_id: 'event:2',
      response: { status_code: 400, body: { error: { message: 'Invalid schema' } } },
      error: null,
    }));
    expect(http?.ok).toBe(false);
    if (http && !http.ok) expect(http.reason).toBe('HTTP 400: Invalid schema');

    const expired = parseOutputLine(JSON.stringify({
      custom_id: 'event:3',
      response: null,
      error: { code: 'batch_expired', message: 'Batch expired' },
    }));
    expect(expired?.ok).toBe(false);
    if (expired && !expired.ok) expect(expired.reason).toBe('batch_expired');
    expect(expired?.usage).toEqual({ input: 0, output: 0 });
  });

  it('ignoriert kaputte Zeilen statt zu werfen', () => {
    expect(parseOutputLine('{not json')).toBeNull();
    expect(parseOutputLine('{"response":{}}')).toBeNull();
  });
});

describe('eventPatchFromContent / activityDescriptionFromContent', () => {
  it('verlangt die Beschreibung nur, wenn das Event eine hat', () => {
    expect(eventPatchFromContent('{"title_en":" Fair ","description_en":"A fair."}', true))
      .toEqual({ patch: { title_en: 'Fair', description_en: 'A fair.' } });
    expect(eventPatchFromContent('{"title_en":"Fair"}', false))
      .toEqual({ patch: { title_en: 'Fair', description_en: null } });
    expect(eventPatchFromContent('{"title_en":"Fair","description_en":""}', true))
      .toEqual({ reason: 'description_en leer' });
    expect(eventPatchFromContent('{"title_en":""}', false)).toEqual({ reason: 'title_en leer' });
    expect(eventPatchFromContent('nope', false)).toEqual({ reason: 'kein gültiges JSON' });
  });

  it('liest die POI-Beschreibung', () => {
    expect(activityDescriptionFromContent('{"description_en":"A pool."}')).toEqual({ description_en: 'A pool.' });
    expect(activityDescriptionFromContent('{"description_en":" "}')).toEqual({ reason: 'description_en leer' });
  });
});

describe('qualityIssue', () => {
  const german =
    'Am Samstag lädt der Musikverein zu einem gemütlichen Fest ins Musikheim ein. ' +
    'Ab 16 Uhr gibt es Musik, und für das leibliche Wohl ist mit Speisen und Getränken bestens gesorgt. ' +
    'Der Eintritt ist frei, und wir freuen uns auf euer Kommen bei hoffentlich schönem Wetter.';
  const english =
    'On Saturday the music association invites you to a cozy festival at the music hall. ' +
    'From 4 pm there will be music, and food and drinks will be well taken care of. ' +
    'Admission is free, and we look forward to seeing you, hopefully in fine weather.';

  it('laesst eine normale Uebersetzung durch', () => {
    expect(qualityIssue(german, english)).toBeNull();
  });

  it('erkennt, wenn der Text gar nicht uebersetzt wurde', () => {
    expect(qualityIssue(german, german)).toMatch(/nicht übersetzt/);
  });

  it('erkennt abgebrochene und ausgeschmueckte Texte am Laengenverhaeltnis', () => {
    expect(qualityIssue(german, english.slice(0, 60))).toMatch(/zu kurz/);
    expect(qualityIssue(german, english.repeat(3))).toMatch(/zu lang/);
  });

  it('prueft kurze Quellen nicht — Titel und Einzeiler sind statistisch wertlos', () => {
    expect(qualityIssue('Kirtag in Rust', 'Kirtag in Rust')).toBeNull();
  });
});

describe('estimateCostUsd', () => {
  it('rechnet mit Batch-Preisen und kennt unbekannte Modelle nicht', () => {
    expect(estimateCostUsd('gpt-4.1-nano', { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(0.25, 6);
    expect(estimateCostUsd('gpt-4o-mini', { input: 2_000_000, output: 0 })).toBeCloseTo(0.15, 6);
    expect(estimateCostUsd('gpt-99', { input: 1, output: 1 })).toBeNull();
  });
});
