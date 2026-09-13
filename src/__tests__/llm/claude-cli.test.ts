import { describe, it, expect } from 'vitest';
import {
  buildClaudeArgs, buildClaudeEnv, parseClaudeOutput, ClaudeCliError,
} from '@/lib/llm/claude-cli';

const ALL = new Set(['--max-turns', '--json-schema']);

describe('buildClaudeArgs', () => {
  it('laeuft nie im Bare-Modus, sonst greift das Abo-Token nicht', () => {
    expect(buildClaudeArgs({}, ALL)).not.toContain('--bare');
  });

  it('setzt Print-Modus, JSON-Ausgabe und dontAsk als Grundausstattung', () => {
    const args = buildClaudeArgs({}, ALL);
    expect(args).toEqual(['-p', '--output-format', 'json', '--permission-mode', 'dontAsk']);
  });

  it('reicht Modell, Werkzeuge, Rundenlimit und Schema durch', () => {
    const args = buildClaudeArgs({
      model: 'sonnet', allowedTools: ['WebSearch', 'WebFetch'], maxTurns: 14, jsonSchema: { type: 'object' },
    }, ALL);
    expect(args).toContain('--model'); expect(args).toContain('sonnet');
    expect(args).toContain('--allowedTools'); expect(args).toContain('WebSearch,WebFetch');
    expect(args).toContain('--max-turns'); expect(args).toContain('14');
    expect(args).toContain('--json-schema'); expect(args).toContain('{"type":"object"}');
  });

  it('laesst --max-turns weg, wenn die installierte CLI es nicht kennt', () => {
    const old = new Set(['--json-schema']);
    const args = buildClaudeArgs({ maxTurns: 14 }, old);
    expect(args).not.toContain('--max-turns');
  });
});

describe('buildClaudeEnv', () => {
  it('entfernt den API-Key, damit der Lauf nicht aufs leere API-Konto kippt', () => {
    const env = buildClaudeEnv({ ANTHROPIC_API_KEY: 'sk-x', CLAUDE_CODE_OAUTH_TOKEN: 'tok', PATH: '/bin' } as unknown as NodeJS.ProcessEnv);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe('tok');
    expect(env.PATH).toBe('/bin');
  });

  it('veraendert die uebergebene Umgebung nicht', () => {
    const base = { ANTHROPIC_API_KEY: 'sk-x' } as unknown as NodeJS.ProcessEnv;
    buildClaudeEnv(base);
    expect(base.ANTHROPIC_API_KEY).toBe('sk-x');
  });
});

describe('parseClaudeOutput', () => {
  it('liest das Ergebnis-JSON', () => {
    const r = parseClaudeOutput('{"result":"hi","is_error":false,"num_turns":1}');
    expect(r.result).toBe('hi');
    expect(r.is_error).toBe(false);
  });

  it('ueberspringt Zeilen vor dem JSON', () => {
    const r = parseClaudeOutput('Warning: something\n{"result":"ok"}');
    expect(r.result).toBe('ok');
  });

  it('wirft bei Ausgabe ohne JSON einen ClaudeCliError', () => {
    expect(() => parseClaudeOutput('nothing here')).toThrow(ClaudeCliError);
  });

  it('wirft bei kaputtem JSON einen ClaudeCliError', () => {
    expect(() => parseClaudeOutput('{"result": ')).toThrow(ClaudeCliError);
  });
});
