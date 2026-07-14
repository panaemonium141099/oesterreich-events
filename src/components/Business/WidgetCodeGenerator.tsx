'use client';

import { useState } from 'react';

/**
 * WidgetCodeGenerator — Region wählen, Embed-Code kopieren, Live-Vorschau.
 *
 * Der generierte Code besteht aus zwei Teilen:
 *   1. dem <iframe> auf /widget/[region] (framebar via CSP frame-ancestors,
 *      siehe next.config.ts)
 *   2. einem sichtbaren <a>-Backlink UNTER dem iframe — der eigentliche
 *      SEO-Gegenwert der kostenlosen Nutzung. Links im iframe zählen für
 *      Suchmaschinen nicht als Backlink, der <p><a>-Teil schon.
 *
 * Bewusst hartcodierte Regions-Liste (9 Bundesländer ändern sich nicht) —
 * districtsAT zu importieren würde die komplette Bezirksliste in den
 * Client-Bundle der /fuer-firmen-Seite ziehen.
 */

const REGIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'oesterreich', label: 'Ganz Österreich' },
  { value: 'wien', label: 'Wien' },
  { value: 'niederoesterreich', label: 'Niederösterreich' },
  { value: 'oberoesterreich', label: 'Oberösterreich' },
  { value: 'steiermark', label: 'Steiermark' },
  { value: 'tirol', label: 'Tirol' },
  { value: 'salzburg', label: 'Salzburg' },
  { value: 'kaernten', label: 'Kärnten' },
  { value: 'vorarlberg', label: 'Vorarlberg' },
  { value: 'burgenland', label: 'Burgenland' },
];

function embedCode(region: string, label: string): string {
  const hub = region === 'oesterreich' ? '/entdecken' : `/${region}`;
  const inLabel = region === 'oesterreich' ? 'Österreich' : label;
  return [
    '<!-- LassTreffen.at Event-Widget -->',
    `<iframe src="https://lasstreffen.at/widget/${region}"`,
    `  title="Events in ${inLabel} – LassTreffen.at"`,
    '  style="width:100%;max-width:420px;height:560px;border:0;border-radius:16px"',
    '  loading="lazy"></iframe>',
    `<p style="margin:6px 0 0;font-size:12px"><a href="https://lasstreffen.at${hub}"`,
    `  target="_blank" rel="noopener">Mehr Events in ${inLabel} auf LassTreffen.at</a></p>`,
  ].join('\n');
}

export function WidgetCodeGenerator() {
  const [region, setRegion] = useState('oesterreich');
  const [copied, setCopied] = useState(false);

  const label = REGIONS.find((r) => r.value === region)?.label ?? region;
  const code = embedCode(region, label);

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
          Region
        </label>
        <select
          id="widget-region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-white/30 mb-4"
        >
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value} className="bg-neutral-900">
              {r.label}
            </option>
          ))}
        </select>

        <pre className="rounded-xl bg-black/60 border border-white/10 p-4 text-[12px] leading-relaxed text-emerald-200/90 overflow-x-auto whitespace-pre">
          {code}
        </pre>

        <button
          type="button"
          onClick={copy}
          data-track="widget_code_copy"
          data-track-id={region}
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
          src={`/widget/${region}`}
          title={`Events in ${label} – LassTreffen.at`}
          style={{ width: '100%', maxWidth: 420, height: 560, border: 0, borderRadius: 16 }}
          loading="lazy"
        />
        {/* Manche Umgebungen (Firmen-Proxys, strikte Blocker) unterbinden
            iframes generell — der Direktlink funktioniert immer. */}
        <p className="text-xs text-white/35 mt-2">
          Vorschau bleibt leer?{' '}
          <a
            href={`/widget/${region}`}
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
