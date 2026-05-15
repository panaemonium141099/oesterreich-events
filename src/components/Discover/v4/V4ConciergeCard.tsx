'use client';

/**
 * V4ConciergeCard — Goldene Tipp-Karte oberhalb der Smart-Suche-Results.
 *
 * Konsumiert den SSE-Stream von /api/search/concierge und rendert ihn
 * progressiv (Typewriter-Effekt). Citations werden als kleine
 * Quellen-Liste unter dem Text angezeigt.
 *
 * Skeleton-State während die ersten Tokens noch nicht da sind.
 *
 * Auto-Hide wenn das Backend nichts streamt (z.B. wenn der Client gar
 * keinen Concierge-Call ausgelöst hat).
 */

import { useEffect, useRef, useState } from 'react';

export interface ConciergePayload {
  query: string;
  parsed?: {
    embedded_text?: string;
    after_date?: string | null;
    before_date?: string | null;
    max_price_tier?: string | null;
    signals?: string[];
  };
  matches?: Array<{
    title: string;
    location_name: string | null;
    category: string | null;
    start_date: string;
    bundesland: string | null;
    price_text: string | null;
    _similarity: number;
  }>;
  count?: number;
  scopeLabel?: string;
}

interface V4ConciergeCardProps {
  /** Payload that triggers a new concierge call when reference changes. */
  payload: ConciergePayload | null;
}

interface Citation { url: string; title: string | null }

/**
 * Wandelt plain-text URLs in klickbare Links + strippt Markdown-Müll
 * (Headers, [text](url)-Syntax, Aufzählungssternchen) für saubere
 * Darstellung. Der System-Prompt verbietet Markdown explizit, aber
 * gelegentlich liefert das LLM trotzdem welche zurück — wir parsen
 * defensiv damit der User es nie als Rohtext sieht.
 */
function renderConciergeText(text: string): React.ReactNode[] {
  // Strip leading ##/###-Header und Aufzählungs-Sternchen am Zeilenanfang.
  const cleaned = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ');

  // 1. Markdown-Links: [label](url) → wir behalten label und schmeißen url in URL-Pool
  // 2. Bare URLs: https://... → werden klickbar
  const segments: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s)>\]]+/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = regex.exec(cleaned)) !== null) {
    if (m.index > lastIdx) {
      segments.push(cleaned.slice(lastIdx, m.index));
    }
    const label = m[1];
    const url = m[2] || m[0];
    segments.push(
      <a
        key={`l${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-[var(--v4-match)] underline decoration-dotted underline-offset-2 hover:text-[var(--v4-ink)]"
      >
        {label ?? url}
      </a>,
    );
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < cleaned.length) {
    segments.push(cleaned.slice(lastIdx));
  }
  return segments;
}

export function V4ConciergeCard({ payload }: V4ConciergeCardProps) {
  const [text, setText] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!payload) return;

    // Abort any in-flight stream when a new payload arrives.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText('');
    setCitations([]);
    setError(null);
    setStreaming(true);

    (async () => {
      try {
        const res = await fetch('/api/search/concierge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setError('Concierge nicht erreichbar');
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE format: "event: <name>\ndata: <json>\n\n"
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const lines = chunk.split('\n');
            const evLine = lines.find(l => l.startsWith('event: '));
            const dataLine = lines.find(l => l.startsWith('data: '));
            if (!evLine || !dataLine) continue;
            const evName = evLine.slice(7).trim();
            let data: Record<string, unknown>;
            try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }

            if (evName === 'text' && typeof data.delta === 'string') {
              setText(prev => prev + (data.delta as string));
            } else if (evName === 'done') {
              const cits = (data.citations as Citation[] | undefined) ?? [];
              if (cits.length > 0) setCitations(cits);
              setStreaming(false);
            } else if (evName === 'error') {
              setError(String(data.message ?? 'Concierge-Fehler'));
              setStreaming(false);
            }
          }
        }
        setStreaming(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
        setStreaming(false);
      }
    })();

    return () => { controller.abort(); };
  }, [payload]);

  if (!payload) return null;

  // Auto-hide if backend returned nothing usable and we're done streaming.
  if (!streaming && !text && !error) return null;

  return (
    <div
      className="rounded-2xl border p-4 md:p-5 mb-5"
      style={{
        background: 'rgba(245,185,66,0.06)',
        borderColor: 'rgba(245,185,66,0.28)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: 'rgba(245,185,66,0.16)',
            border: '1px solid rgba(245,185,66,0.34)',
            color: 'var(--v4-match)',
          }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-match)] mb-1.5">
            Concierge-Tipp
          </p>
          {error ? (
            <p className="text-[13px] text-[var(--v4-ink-70)]">{error}</p>
          ) : (
            <p className="text-[14px] leading-[1.55] text-[var(--v4-ink)] whitespace-pre-wrap">
              {renderConciergeText(text)}
              {streaming && <span className="inline-block w-[7px] h-[15px] ml-0.5 align-middle bg-[var(--v4-match)] animate-pulse"/>}
            </p>
          )}
          {citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[rgba(245,185,66,0.18)]">
              <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mb-1.5">Quellen</p>
              <ul className="flex flex-col gap-1">
                {citations.map((c, i) => (
                  <li key={i}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-[12px] text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] underline decoration-dotted underline-offset-2 break-all"
                    >
                      {c.title || c.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
