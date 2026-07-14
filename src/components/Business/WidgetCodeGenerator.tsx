'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * WidgetCodeGenerator — Region/Bezirk/Gemeinde per Typeahead wählen,
 * Embed-Code kopieren, Live-Vorschau.
 *
 * Suche: /api/widget/suggest (debounced) — matcht Bundesländer, ~120
 * Bezirke und ~2.000 Gemeinden serverseitig aus statischen Daten; die
 * volle Liste wäre zu groß fürs Client-Bundle. Ohne Eingabe zeigt das
 * Feld die 10 Regionen als Schnellauswahl.
 *
 * Der generierte Code besteht aus zwei Teilen:
 *   1. dem <iframe> auf /widget/[slug] (framebar via CSP frame-ancestors,
 *      siehe next.config.ts)
 *   2. einem sichtbaren <a>-Backlink UNTER dem iframe — der eigentliche
 *      SEO-Gegenwert der kostenlosen Nutzung. Links im iframe zählen für
 *      Suchmaschinen nicht als Backlink, der <p><a>-Teil schon.
 */

interface Suggestion {
  slug: string;
  label: string;
  sub: string;
}

const QUICK_REGIONS: Suggestion[] = [
  { slug: 'oesterreich', label: 'Ganz Österreich', sub: 'Alle Regionen' },
  { slug: 'wien', label: 'Wien', sub: 'Bundesland' },
  { slug: 'niederoesterreich', label: 'Niederösterreich', sub: 'Bundesland' },
  { slug: 'oberoesterreich', label: 'Oberösterreich', sub: 'Bundesland' },
  { slug: 'steiermark', label: 'Steiermark', sub: 'Bundesland' },
  { slug: 'tirol', label: 'Tirol', sub: 'Bundesland' },
  { slug: 'salzburg', label: 'Salzburg', sub: 'Bundesland' },
  { slug: 'kaernten', label: 'Kärnten', sub: 'Bundesland' },
  { slug: 'vorarlberg', label: 'Vorarlberg', sub: 'Bundesland' },
  { slug: 'burgenland', label: 'Burgenland', sub: 'Bundesland' },
];

/** Backlink-Ziel je Scope — muss zur hubPath-Logik in scopes.ts passen. */
function hubUrl(s: Suggestion): string {
  if (s.slug === 'oesterreich') return 'https://lasstreffen.at/entdecken';
  if (s.sub === 'Bundesland') return `https://lasstreffen.at/${s.slug}`;
  if (s.sub.startsWith('Gemeinde')) return `https://lasstreffen.at/gemeinde/${s.slug}`;
  // Bezirk: kein eigener Hub — aufs Bundesland verlinken.
  const bl = s.sub.split('·')[1]?.trim() ?? '';
  const blSlug = bl.toLowerCase().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue');
  return blSlug ? `https://lasstreffen.at/${blSlug}` : 'https://lasstreffen.at/entdecken';
}

function embedCode(s: Suggestion): string {
  const inLabel = s.slug === 'oesterreich' ? 'Österreich' : s.label;
  return [
    '<!-- LassTreffen.at Event-Widget -->',
    `<iframe src="https://lasstreffen.at/widget/${s.slug}"`,
    `  title="Events in ${inLabel} – LassTreffen.at"`,
    '  style="width:100%;max-width:420px;height:560px;border:0;border-radius:16px"',
    '  loading="lazy"></iframe>',
    `<p style="margin:6px 0 0;font-size:12px"><a href="${hubUrl(s)}"`,
    `  target="_blank" rel="noopener">Mehr Events in ${inLabel} auf LassTreffen.at</a></p>`,
  ].join('\n');
}

export function WidgetCodeGenerator() {
  const [selected, setSelected] = useState<Suggestion>(QUICK_REGIONS[0]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(QUICK_REGIONS);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced Suggest-Fetch; leere Eingabe → Regionen-Schnellauswahl.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = input.trim();
    if (q.length < 2) {
      setSuggestions(QUICK_REGIONS);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/widget/suggest?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions);
      } catch {
        // Netzfehler: Dropdown behält den letzten Stand.
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  // Klick außerhalb schließt das Dropdown.
  useEffect(() => {
    function onDown(ev: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function choose(s: Suggestion) {
    setSelected(s);
    setInput('');
    setOpen(false);
  }

  const code = embedCode(selected);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-API blockiert (z. B. http) — Code bleibt markierbar.
    }
  }

  return (
    <div className="mt-8 grid lg:grid-cols-2 gap-6 items-start">
      {/* Konfiguration + Code */}
      <div>
        <label htmlFor="widget-region" className="block text-sm font-semibold mb-2 text-white/70">
          Region, Bezirk oder Gemeinde
        </label>
        <div ref={boxRef} className="relative mb-4">
          <input
            id="widget-region"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="widget-region-listbox"
            autoComplete="off"
            placeholder={`${selected.label} — tippen zum Suchen …`}
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
          />
          {open && suggestions.length > 0 && (
            <ul
              id="widget-region-listbox"
              role="listbox"
              className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/60"
            >
              {suggestions.map((s) => (
                <li key={s.slug} role="option" aria-selected={s.slug === selected.slug}>
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/[0.07] flex items-baseline justify-between gap-3"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs text-white/35 whitespace-nowrap">{s.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-sm text-white/50 mb-3">
          Ausgewählt: <span className="font-semibold text-white/80">{selected.label}</span>
          <span className="text-white/35"> ({selected.sub})</span>
        </p>

        <pre className="rounded-xl bg-black/60 border border-white/10 p-4 text-[12px] leading-relaxed text-emerald-200/90 overflow-x-auto whitespace-pre">
          {code}
        </pre>

        <button
          type="button"
          onClick={copy}
          data-track="widget_code_copy"
          data-track-id={selected.slug}
          className="mt-3 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
        >
          {copied ? 'Kopiert ✓' : 'Code kopieren'}
        </button>

        <p className="text-xs text-white/35 mt-4 leading-relaxed">
          Kostenlos nutzbar — einzige Bedingung ist der Link unter dem Widget
          (bitte nicht entfernen). Das Widget aktualisiert sich automatisch,
          ihr müsst nichts pflegen.
        </p>
      </div>

      {/* Live-Vorschau */}
      <div>
        <p className="text-sm font-semibold mb-2 text-white/70">Vorschau</p>
        <iframe
          key={selected.slug}
          src={`/widget/${selected.slug}`}
          title={`Events in ${selected.label} – LassTreffen.at`}
          style={{ width: '100%', maxWidth: 420, height: 560, border: 0, borderRadius: 16 }}
          loading="lazy"
        />
        {/* Manche Umgebungen (Firmen-Proxys, strikte Blocker) unterbinden
            iframes generell — der Direktlink funktioniert immer. */}
        <p className="text-xs text-white/35 mt-2">
          Vorschau bleibt leer?{' '}
          <a
            href={`/widget/${selected.slug}`}
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 text-white/60 hover:text-white"
          >
            Widget im neuen Tab öffnen ↗
          </a>
        </p>
      </div>
    </div>
  );
}
