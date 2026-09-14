/**
 * Claude Code CLI (`claude -p`) als Textgenerator für Batch-Skripte.
 *
 * ── Warum die CLI und nicht das SDK ──────────────────────────────────────
 * Das Anthropic-SDK rechnet über API-Guthaben ab, und das steht bei uns auf
 * null (MASTERPLAN). `claude -p` läuft dagegen über das Claude-Abo des
 * Betreibers: ein mit `claude setup-token` erzeugtes, ein Jahr gültiges
 * OAuth-Token in `CLAUDE_CODE_OAUTH_TOKEN` authentifiziert die CLI auch ohne
 * Browser, ausdrücklich gedacht für "CI pipelines, scripts". Damit schreibt
 * der Blog-Autowriter ohne laufende Kosten.
 *
 * ── Betriebsregeln, die hier eingebaut sind ──────────────────────────────
 * • KEIN `--bare`: der Bare-Modus liest weder OAuth-Token noch Abo-Login.
 * • `ANTHROPIC_API_KEY` wird aus der Kind-Umgebung entfernt. Sie hätte
 *   Vorrang vor dem Abo-Token und würde gegen das leere API-Konto laufen.
 * • Arbeitsverzeichnis ist ein frisches Temp-Verzeichnis. Ohne `--bare` lädt
 *   die CLI sonst CLAUDE.md, Hooks und `.mcp.json` des Repos in jeden Lauf.
 * • `--permission-mode dontAsk`: alles, was einen Menschen fragen müsste,
 *   wird abgelehnt statt zu hängen. Erlaubt ist nur, was `allowedTools` nennt.
 * • Fehler kommen nicht als Exit-Code, sondern als `is_error` im JSON
 *   ("Not logged in", Rate-Limit …) und werden hier zu Exceptions, damit der
 *   Workflow laut scheitert statt einen leeren Post zu schreiben.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ClaudeCliOptions {
  /** Modell-Alias oder -ID, z. B. "sonnet", "opus". Default: CLI-Standard. */
  model?: string;
  /** Werkzeuge, die ohne Rückfrage laufen dürfen, z. B. ['WebSearch', 'WebFetch']. */
  allowedTools?: string[];
  /** Obergrenze für Agenten-Runden (jede Websuche ist eine Runde). */
  maxTurns?: number;
  /** JSON-Schema für strukturierte Ausgabe (`structured_output`). */
  jsonSchema?: Record<string, unknown>;
  /** Harte Zeitgrenze pro Aufruf. Default 6 min. */
  timeoutMs?: number;
}

/** Antwort von `claude -p --output-format json` (Auszug). */
export interface ClaudeCliResult {
  result?: string;
  structured_output?: unknown;
  is_error?: boolean;
  /** HTTP-Status des letzten API-Fehlers, z. B. 429 beim Sitzungslimit. */
  api_error_status?: number;
  num_turns?: number;
  total_cost_usd?: number;
  session_id?: string;
}

export class ClaudeCliError extends Error {
  constructor(message: string, readonly raw?: ClaudeCliResult) {
    super(message);
    this.name = 'ClaudeCliError';
  }
}

/**
 * Das Abo-Kontingent ist fuer diese Sitzung aufgebraucht (HTTP 429,
 * "You've hit your session limit · resets 11:10am (UTC)"). Kein Defekt,
 * sondern eine Frage des Zeitpunkts: das 5-Stunden-Fenster teilt sich der
 * Cron mit der interaktiven Arbeit des Betreibers. Aufrufer koennen damit
 * "spaeter nochmal" von "kaputt" unterscheiden.
 */
export class ClaudeRateLimitError extends ClaudeCliError {
  constructor(message: string, readonly resetsAt: Date | null, raw?: ClaudeCliResult) {
    super(message, raw);
    this.name = 'ClaudeRateLimitError';
  }
}

const DEFAULT_TIMEOUT_MS = 6 * 60_000;
/** So lange warten wir hoechstens auf das Ende eines Sitzungslimits. */
const RATE_LIMIT_MAX_WAIT_MS = 50 * 60_000;

/**
 * "resets 11:10am (UTC)" -> naechster Zeitpunkt mit dieser Uhrzeit in UTC.
 * Liegt die Uhrzeit heute schon hinter uns, ist morgen gemeint.
 */
export function parseResetTime(text: string, now: Date = new Date()): Date | null {
  const m = text.match(/resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*\(UTC\)/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? '0');
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0));
  if (reset.getTime() <= now.getTime()) reset.setUTCDate(reset.getUTCDate() + 1);
  return reset;
}

function isSessionLimit(res: ClaudeCliResult): boolean {
  return res.api_error_status === 429 || /session limit|usage limit|rate limit/i.test(res.result ?? '');
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Reine Funktion, damit die Flag-Zusammenstellung testbar ist. */
export function buildClaudeArgs(opts: ClaudeCliOptions, supported: Set<string> = ALL_FLAGS): string[] {
  const args = ['-p', '--output-format', 'json', '--permission-mode', 'dontAsk'];
  if (opts.model) args.push('--model', opts.model);
  if (opts.allowedTools?.length) args.push('--allowedTools', opts.allowedTools.join(','));
  // Aeltere CLI-Versionen (z. B. 2.1.193) kennen --max-turns nicht und
  // brechen mit "unknown option" ab. Dann laeuft der Aufruf ohne Rundenlimit,
  // gedeckelt nur durch den Timeout.
  if (opts.maxTurns && supported.has('--max-turns')) args.push('--max-turns', String(opts.maxTurns));
  if (opts.jsonSchema) args.push('--json-schema', JSON.stringify(opts.jsonSchema));
  return args;
}

const ALL_FLAGS = new Set(['--max-turns', '--json-schema']);
let supportedFlagsCache: Set<string> | null = null;

/** Einmal `claude --help` lesen und merken, welche optionalen Flags es gibt. */
export function supportedFlags(): Set<string> {
  if (supportedFlagsCache) return supportedFlagsCache;
  const out = spawnSync(claudeBinary(), ['--help'], {
    encoding: 'utf8', windowsHide: true, timeout: 20_000,
  });
  const help = `${out.stdout ?? ''}${out.stderr ?? ''}`;
  supportedFlagsCache = new Set([...ALL_FLAGS].filter(f => help.includes(f)));
  return supportedFlagsCache;
}

/** Umgebung für den Kindprozess: Abo-Token rein, API-Key raus. */
export function buildClaudeEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...base };
  // Vorrang-Reihenfolge der CLI: ANTHROPIC_API_KEY schlägt CLAUDE_CODE_OAUTH_TOKEN.
  // Ein versehentlich gesetzter Key würde den Lauf still aufs API-Konto umleiten.
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

/** Aus dem stdout das JSON-Objekt herauslösen, auch wenn davor Zeilen stehen. */
export function parseClaudeOutput(stdout: string): ClaudeCliResult {
  const start = stdout.indexOf('{');
  if (start === -1) throw new ClaudeCliError(`Kein JSON in der CLI-Ausgabe: ${stdout.slice(0, 200)}`);
  try {
    return JSON.parse(stdout.slice(start)) as ClaudeCliResult;
  } catch {
    throw new ClaudeCliError(`CLI-Ausgabe ist kein gültiges JSON: ${stdout.slice(start, start + 200)}`);
  }
}

/**
 * Pfad zur CLI. `CLAUDE_BIN` erlaubt einen absoluten Pfad, z. B. lokal unter
 * Windows, wo der native Installer nach ~/.local/bin/claude legt und die
 * Datei fuer CreateProcess nicht auf dem PATH liegt. In CI reicht `claude`.
 */
function claudeBinary(): string {
  return process.env.CLAUDE_BIN || 'claude';
}

/**
 * Einen `claude -p`-Lauf ausführen; der Prompt geht über stdin.
 *
 * Meldet die CLI ein Sitzungslimit mit Reset-Zeit, die weniger als
 * RATE_LIMIT_MAX_WAIT_MS entfernt liegt, wartet der Aufruf bis dahin und
 * versucht es genau einmal erneut. Liegt der Reset weiter weg, fliegt ein
 * ClaudeRateLimitError, damit der Workflow den Lauf als "spaeter" statt
 * "kaputt" behandeln kann.
 */
export async function runClaude(prompt: string, opts: ClaudeCliOptions = {}): Promise<ClaudeCliResult> {
  try {
    return await runClaudeOnce(prompt, opts);
  } catch (err) {
    if (!(err instanceof ClaudeRateLimitError) || !err.resetsAt) throw err;
    const waitMs = err.resetsAt.getTime() - Date.now() + 30_000;
    if (waitMs > RATE_LIMIT_MAX_WAIT_MS) throw err;
    console.log(`[claude-cli] Sitzungslimit — warte ${Math.ceil(waitMs / 60_000)} min bis ${err.resetsAt.toISOString()} und versuche es einmal erneut.`);
    await sleep(waitMs);
    return runClaudeOnce(prompt, opts);
  }
}

async function runClaudeOnce(prompt: string, opts: ClaudeCliOptions = {}): Promise<ClaudeCliResult> {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'claude-p-'));
  const args = buildClaudeArgs(opts, supportedFlags());
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const { stdout, stderr, code } = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
      (resolve, reject) => {
        const child = spawn(claudeBinary(), args, {
          cwd,
          env: buildClaudeEnv(),
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        let out = '';
        let err = '';
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new ClaudeCliError(`claude -p hat nach ${Math.round(timeoutMs / 1000)} s nicht geantwortet`));
        }, timeoutMs);
        child.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
        child.stderr.on('data', (d: Buffer) => { err += d.toString('utf8'); });
        child.on('error', (e) => { clearTimeout(timer); reject(new ClaudeCliError(`claude nicht startbar: ${e.message}`)); });
        child.on('close', (c) => { clearTimeout(timer); resolve({ stdout: out, stderr: err, code: c }); });
        child.stdin.on('error', () => { /* Kind schon weg — close liefert den Grund */ });
        child.stdin.end(prompt, 'utf8');
      },
    );

    if (!stdout.trim()) {
      throw new ClaudeCliError(`claude -p ohne Ausgabe (Exit ${code}): ${stderr.trim().slice(0, 300)}`);
    }
    const parsed = parseClaudeOutput(stdout);
    if (parsed.is_error) {
      const text = parsed.result ?? '(ohne Text)';
      if (isSessionLimit(parsed)) {
        throw new ClaudeRateLimitError(`Abo-Sitzungslimit: ${text}`, parseResetTime(text), parsed);
      }
      throw new ClaudeCliError(`claude -p meldet Fehler: ${text}`, parsed);
    }
    return parsed;
  } finally {
    // Unter Windows haelt die CLI das Verzeichnis manchmal noch kurz offen
    // (EPERM). Ein liegengebliebenes leeres Temp-Verzeichnis ist kein Grund,
    // ein fertiges Ergebnis wegzuwerfen.
    try { rmSync(cwd, { recursive: true, force: true }); } catch { /* egal */ }
  }
}

/** Freitext-Antwort, z. B. eine Recherche mit Websuche. */
export async function claudeText(prompt: string, opts: ClaudeCliOptions = {}): Promise<string> {
  const res = await runClaude(prompt, opts);
  const text = (res.result ?? '').trim();
  if (!text) throw new ClaudeCliError('claude -p lieferte keinen Text', res);
  return text;
}

/**
 * Strukturierte Antwort gegen ein JSON-Schema. Ohne Werkzeuge, ein Durchgang:
 * der Prompt trägt alle Fakten schon in sich (Recherche-Ergebnis), das Modell
 * soll nur noch formulieren.
 */
export async function claudeJson<T = Record<string, unknown>>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  opts: Omit<ClaudeCliOptions, 'jsonSchema'> = {},
): Promise<T> {
  const res = await runClaude(prompt, { ...opts, jsonSchema, maxTurns: opts.maxTurns ?? 1 });
  if (res.structured_output && typeof res.structured_output === 'object') {
    return res.structured_output as T;
  }
  // Ältere CLI-Versionen kennen `--json-schema` nicht und liefern den Text
  // in `result`; dort steht dann das rohe JSON, ggf. in einem Codeblock.
  const text = (res.result ?? '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.slice(candidate.indexOf('{'))) as T;
  } catch {
    throw new ClaudeCliError('claude -p lieferte kein strukturiertes JSON', res);
  }
}
