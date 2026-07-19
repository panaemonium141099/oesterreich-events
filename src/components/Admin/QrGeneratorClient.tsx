'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useAuth } from '@/lib/supabase/auth-context';

/**
 * QrGeneratorClient — QR-Codes für Tourismusbüros & Partner (fn-17 Slice 4).
 *
 * Ziel wählen (Typeahead über /api/widget/suggest: Bundesländer, Bezirke,
 * ~2.000 Gemeinden — gleiche Quelle wie der Widget-Generator) ODER freien
 * Pfad eingeben, Sprache DE/EN umschalten (EN = /en-Präfix, fn-17),
 * utm_source fürs Tracking. QR wird lokal im Browser gerendert (qrcode-
 * Package, kein externer Dienst) — Download als PNG (1024px, druckfähig)
 * und SVG (Vektordruck).
 *
 * utm_medium=qr ist fix; die Klicks laufen damit sauber getrennt in der
 * eigenen analytics_events-Auswertung und in GSC/GA auf.
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

/** Öffentlicher Hub-Pfad je Scope — gleiche Logik wie WidgetCodeGenerator.hubUrl. */
function hubPath(s: Suggestion): string {
  if (s.slug === 'oesterreich') return '/entdecken';
  if (s.sub === 'Bundesland') return `/${s.slug}`;
  if (s.sub.startsWith('Gemeinde')) return `/gemeinde/${s.slug}`;
  const bl = s.sub.split('·')[1]?.trim() ?? '';
  const blSlug = bl.toLowerCase().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue');
  return blSlug ? `/${blSlug}` : '/entdecken';
}

function slugifySource(v: string): string {
  return v
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function QrGeneratorClient() {
  // Gleicher Client-Guard wie /admin/overview: Anonyme → Login, Nicht-Admins → /map
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
    if (!loading && user && profile && profile.role !== 'god' && profile.role !== 'admin') {
      router.push('/map');
    }
  }, [loading, user, profile, router]);

  const [selected, setSelected] = useState<Suggestion>(QUICK_REGIONS[0]);
  const [customPath, setCustomPath] = useState('');
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(QUICK_REGIONS);
  const [locale, setLocale] = useState<'de' | 'en'>('de');
  const [utmSource, setUtmSource] = useState('');
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const basePath = customPath.trim()
    ? (customPath.trim().startsWith('/') ? customPath.trim() : `/${customPath.trim()}`)
    : hubPath(selected);
  const localizedPath = locale === 'en' ? `/en${basePath === '/' ? '' : basePath}` : basePath;
  const params = new URLSearchParams({ utm_medium: 'qr', utm_campaign: 'tourismus' });
  if (slugifySource(utmSource)) params.set('utm_source', slugifySource(utmSource));
  const finalUrl = `https://lasstreffen.at${localizedPath}?${params.toString()}`;

  // Debounced Suggest (gleiches Muster wie WidgetCodeGenerator)
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

  useEffect(() => {
    function onDown(ev: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // QR live rendern (SVG für die scharfe Vorschau)
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(finalUrl, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(s => { if (!cancelled) setSvg(s); })
      .catch(() => { if (!cancelled) setSvg(''); });
    return () => { cancelled = true; };
  }, [finalUrl]);

  async function downloadPng() {
    const dataUrl = await QRCode.toDataURL(finalUrl, {
      width: 1024, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    triggerDownload(dataUrl, `qr-${fileStem()}.png`);
  }

  function downloadSvg() {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `qr-${fileStem()}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function fileStem(): string {
    const scope = customPath.trim() ? slugifySource(customPath) || 'custom' : selected.slug;
    const src = slugifySource(utmSource);
    return [scope, locale, src].filter(Boolean).join('-');
  }

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard verweigert (z. B. HTTP) — URL steht sichtbar daneben.
    }
  }

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 max-w-4xl">
      <div className="flex flex-col gap-5">
        {/* Ziel */}
        <div ref={boxRef} className="relative">
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
            Ziel-Region / Gemeinde
          </label>
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={`${selected.label} (${selected.sub}) — tippen zum Suchen`}
            className={inputCls}
          />
          {open && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-white/10 bg-[#141416] shadow-xl">
              {suggestions.map(s => (
                <button
                  key={`${s.slug}-${s.sub}`}
                  type="button"
                  onClick={() => { setSelected(s); setCustomPath(''); setInput(''); setOpen(false); }}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]"
                >
                  <span>{s.label}</span>
                  <span className="text-xs text-white/40">{s.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Freier Pfad */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
            Oder freier Pfad (überschreibt die Auswahl)
          </label>
          <input
            value={customPath}
            onChange={e => setCustomPath(e.target.value)}
            placeholder="/thema/heurigen oder /events/7141-podersdorf-am-see/…"
            className={inputCls}
          />
        </div>

        {/* Sprache */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
            Sprache des QR-Ziels
          </label>
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
            {(['de', 'en'] as const).map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={
                  'px-4 py-2 text-sm font-semibold transition-colors ' +
                  (locale === l ? 'bg-white text-black' : 'bg-transparent text-white/60 hover:text-white')
                }
              >
                {l === 'de' ? 'Deutsch' : 'English'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-white/35">
            English erzeugt den /en-Link — für internationale Gäste im Tourismusbüro.
          </p>
        </div>

        {/* utm_source */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
            utm_source (wer hängt den QR auf?)
          </label>
          <input
            value={utmSource}
            onChange={e => setUtmSource(e.target.value)}
            placeholder="z. B. tourismusbuero-podersdorf"
            className={inputCls}
          />
          <p className="mt-1.5 text-xs text-white/35">
            utm_medium=qr &amp; utm_campaign=tourismus sind fix — pro Büro nur die Source ändern,
            dann ist jeder Aufsteller einzeln auswertbar.
          </p>
        </div>

        {/* Finale URL */}
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
            Codierte URL
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-emerald-300/90">
              {finalUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.06]"
            >
              {copied ? 'Kopiert ✓' : 'Kopieren'}
            </button>
          </div>
        </div>
      </div>

      {/* Vorschau + Downloads */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-64 h-64 rounded-xl bg-white p-3 [&>svg]:w-full [&>svg]:h-full"
          // qrcode liefert ein selbst erzeugtes, statisches SVG — kein User-HTML
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadPng}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            PNG (1024px)
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.06]"
          >
            SVG
          </button>
        </div>
        <p className="text-center text-xs text-white/35 max-w-56">
          PNG reicht für A6-Aufsteller; SVG für Druckereien (beliebig skalierbar).
        </p>
      </div>
    </div>
  );
}
