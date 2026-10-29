/**
 * Minimale robots.txt-Auswertung für den Registry-Builder (fn-29.4): Gruppe
 * des eigenen User-Agents, sonst `*`; längster passender Allow/Disallow-Pfad
 * gewinnt, bei Gleichstand Allow (RFC 9309). `*` und `$` in Pfaden werden
 * unterstützt. REIN.
 */
interface Rule { allow: boolean; pattern: string }

function groups(txt: string, delays?: Map<string, number>): Map<string, Rule[]> {
  const out = new Map<string, Rule[]>();
  let agents: string[] = [];
  let inRules = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (inRules) { agents = []; inRules = false; }
      agents.push(val.toLowerCase());
      for (const a of agents) if (!out.has(a)) out.set(a, []);
    } else if (key === 'allow' || key === 'disallow') {
      inRules = true;
      if (key === 'disallow' && val === '') continue;
      for (const a of agents) out.get(a)!.push({ allow: key === 'allow', pattern: val });
    } else if (key === 'crawl-delay') {
      inRules = true;
      const s = Number(val.replace(',', '.'));
      if (delays && Number.isFinite(s) && s >= 0) for (const a of agents) delays.set(a, s);
    }
  }
  return out;
}

/** Crawl-delay in Sekunden für `userAgentToken` (eigene Gruppe, sonst `*`), sonst null. */
export function robotsCrawlDelay(robotsTxt: string | null, userAgentToken: string): number | null {
  if (!robotsTxt) return null;
  const delays = new Map<string, number>();
  const g = groups(robotsTxt, delays);
  const token = userAgentToken.toLowerCase();
  const own = [...g.keys()].find(a => a !== '*' && token.includes(a));
  return own ? delays.get(own) ?? null : delays.get('*') ?? null;
}

function matches(pattern: string, path: string): number {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp('^' + body.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
  return re.test(path) ? body.length : -1;
}

/** Darf `userAgentToken` (z. B. „lasstreffen") die URL abrufen? */
export function robotsAllows(robotsTxt: string | null, url: string, userAgentToken: string): boolean {
  if (!robotsTxt) return true;
  const g = groups(robotsTxt);
  const token = userAgentToken.toLowerCase();
  const own = [...g.entries()].find(([a]) => a !== '*' && token.includes(a))?.[1];
  const rules = own ?? g.get('*') ?? [];
  let path: string;
  try { const u = new URL(url); path = u.pathname + u.search; } catch { return false; }
  let best = -1, allow = true;
  for (const r of rules) {
    const len = matches(r.pattern, path);
    if (len > best || (len === best && r.allow)) { best = len; allow = r.allow; }
  }
  return best < 0 ? true : allow;
}
