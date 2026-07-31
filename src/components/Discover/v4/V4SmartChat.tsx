'use client';

/**
 * V4SmartChat — "Weiter planen mit dem Concierge" (fn-19 Phase B).
 *
 * Erscheint unter dem Concierge-Tipp, sobald eine Smart-Suche ein
 * Ergebnis hat. Follow-ups ("eher indoor", "günstiger") gehen an
 * /api/search/chat: Gemini sucht dort per Function-Calling selbst in
 * der DB (runSmartSearch) und referenziert Empfehlungen als Entity-
 * Karten, die hier klickbar gerendert werden.
 *
 * Verlauf ist rein client-seitig (State; Server stateless). Neuer
 * Suchlauf = neue Chat-Session (Parent keyed die Komponente per Query).
 *
 * "Als Plan speichern": baut aus den Event-Karten einer Antwort einen
 * Plan über das bestehende POST /api/plans (Login-Pflicht — 401 zeigt
 * den Anmelde-Hinweis); Aktivitäten wandern als verlinkte Zeilen in die
 * Plan-Notiz, bis plan_items eine activity_id-Spalte hat.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { ChatEntityCard, ChatEventCard, ChatActivityCard } from '@/lib/search/chat-cards';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  cards?: ChatEntityCard[];
  isError?: boolean;
}

type PlanSaveState =
  | { status: 'saving' }
  | { status: 'saved'; planId: string }
  | { status: 'auth' }
  | { status: 'error' };

const FOLLOWUP_CHIPS = ['Eher indoor', 'Günstiger bitte', 'Mit Kindern', 'Lieber am Abend', 'Mach mir einen Tagesplan'];

function EntityCardRow({ card }: { card: ChatEntityCard }) {
  const isEvent = card.kind === 'event';
  const ev = card as ChatEventCard;
  const act = card as ChatActivityCard;
  const href = isEvent
    ? buildEventUrlV2({
        id: ev.id, slug: ev.slug, start_date: ev.start_date,
        postal_code: ev.postal_code, address: ev.address,
        bundesland: ev.bundesland, location_name: ev.location_name,
      })
    : `/aktivitaet/${act.slug}`;
  const title = isEvent ? ev.title : act.name;
  const meta = isEvent
    ? [
        new Date(ev.start_date).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        ev.location_name,
      ].filter(Boolean).join(' · ')
    : [act.town, act.setting === 'indoor' ? 'Indoor' : act.setting === 'outdoor' ? 'Outdoor' : null]
        .filter(Boolean).join(' · ');
  const image = card.image_url;

  return (
    <Link
      href={href}
      data-track="chat_entity_click"
      data-track-id={isEvent ? ev.id : act.slug}
      data-track-provider={card.kind}
      className="press-haptic flex items-center gap-3 rounded-xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors p-2 pr-3"
    >
      <div
        className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative"
        style={image ? undefined : { background: 'linear-gradient(135deg, #475569, #1e293b)' }}
      >
        {image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy"/>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--v4-ink-50)]">
          {isEvent ? 'Event' : 'Aktivität'}
        </p>
        <p className="text-[13.5px] font-semibold text-[var(--v4-ink)] leading-tight line-clamp-1">{title}</p>
        {meta && <p className="text-[11.5px] text-[var(--v4-ink-70)] line-clamp-1">{meta}</p>}
      </div>
    </Link>
  );
}

export function V4SmartChat({ baseQuery }: { baseQuery: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [draftCards, setDraftCards] = useState<ChatEntityCard[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [planSaves, setPlanSaves] = useState<Record<number, PlanSaveState>>({});
  const abortRef = useRef<AbortController | null>(null);

  async function sendMessage(text: string, viaChip: boolean) {
    const msg = text.trim();
    if (!msg || streaming) return;
    trackEvent('chat_message', { followup: turns.length > 0, chip: viaChip });

    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: msg }];
    setTurns(nextTurns);
    setInput('');
    setDraft('');
    setDraftCards([]);
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Verlauf für den stateless Server: Original-Query als erster
    // User-Turn, dann die letzten Chat-Turns (Server-Cap: 12).
    const apiMessages = [
      { role: 'user' as const, content: baseQuery },
      ...nextTurns.slice(-10).map(t => ({ role: t.role, content: t.content })),
    ];

    let acc = '';
    const cards: ChatEntityCard[] = [];
    let commitErr: string | null = null;

    try {
      const res = await fetch('/api/search/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, locale: 'de' }),
        signal: controller.signal,
      });
      if (res.status === 429) {
        commitErr = 'Kurz durchatmen — zu viele Anfragen. Probier es in einer Minute nochmal.';
      } else if (!res.ok || !res.body) {
        commitErr = 'Der Concierge ist gerade nicht erreichbar.';
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const evLine = chunk.split('\n').find(l => l.startsWith('event: '));
            const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
            if (!evLine || !dataLine) continue;
            let data: Record<string, unknown>;
            try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }
            const evName = evLine.slice(7).trim();
            if (evName === 'text' && typeof data.delta === 'string') {
              acc += data.delta;
              setDraft(acc);
            } else if (evName === 'entity' && data.card) {
              cards.push(data.card as ChatEntityCard);
              setDraftCards([...cards]);
            } else if (evName === 'error') {
              commitErr = String(data.message ?? 'Concierge-Fehler');
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        commitErr = 'Verbindung abgerissen — probier es nochmal.';
      }
    }

    setStreaming(false);
    setDraft('');
    setDraftCards([]);
    if (acc.trim()) {
      setTurns(prev => [...prev, { role: 'assistant', content: acc.trim(), cards }]);
    } else {
      setTurns(prev => [...prev, {
        role: 'assistant',
        content: commitErr ?? 'Keine Antwort — probier es nochmal.',
        isError: true,
      }]);
    }
  }

  async function savePlan(turnIdx: number) {
    const turn = turns[turnIdx];
    const events = (turn?.cards ?? []).filter((c): c is ChatEventCard => c.kind === 'event');
    if (events.length === 0) return;
    const activities = (turn?.cards ?? []).filter((c): c is ChatActivityCard => c.kind === 'activity');

    setPlanSaves(p => ({ ...p, [turnIdx]: { status: 'saving' } }));
    trackEvent('chat_save_plan', { events: events.length, activities: activities.length });

    const dates = events.map(e => e.start_date?.slice(0, 10)).filter(Boolean).sort();
    const note = activities.length > 0
      ? 'Ausflugsziele vom Concierge:\n' + activities
          .map(a => `- ${a.name}${a.town ? ` (${a.town})` : ''} → https://lasstreffen.at/aktivitaet/${a.slug}`)
          .join('\n')
      : null;

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `KI-Plan: ${baseQuery.slice(0, 60)}`,
          plan_date: dates[0] ?? new Date().toISOString().slice(0, 10),
          note,
          event_ids: events.map(e => e.id),
        }),
      });
      if (res.status === 401) {
        setPlanSaves(p => ({ ...p, [turnIdx]: { status: 'auth' } }));
      } else if (res.ok) {
        const { plan } = await res.json();
        setPlanSaves(p => ({ ...p, [turnIdx]: { status: 'saved', planId: plan.id } }));
      } else {
        setPlanSaves(p => ({ ...p, [turnIdx]: { status: 'error' } }));
      }
    } catch {
      setPlanSaves(p => ({ ...p, [turnIdx]: { status: 'error' } }));
    }
  }

  return (
    <div
      className="rounded-2xl border p-4 md:p-5 mb-6"
      style={{ background: 'rgba(245,185,66,0.04)', borderColor: 'rgba(245,185,66,0.22)' }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-match)] mb-1">
        Weiter planen mit dem Concierge
      </p>
      <p className="text-[12px] text-[var(--v4-ink-50)] mb-3">
        Verfeinere das Ergebnis oder lass dir einen Tagesplan bauen — die KI sucht live in unserer Datenbank und du kannst das Ergebnis als Plan speichern.
      </p>

      {/* Verlauf */}
      {turns.length > 0 && (
        <div className="flex flex-col gap-3 mb-3">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'self-end max-w-[85%]' : 'self-start w-full'}>
              {t.role === 'user' ? (
                <p className="px-3.5 py-2 rounded-2xl rounded-br-sm bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[13.5px] text-[var(--v4-ink)]">
                  {t.content}
                </p>
              ) : (
                <div>
                  <p className={`text-[14px] leading-[1.55] whitespace-pre-wrap break-words ${t.isError ? 'text-[var(--v4-ink-50)]' : 'text-[var(--v4-ink)]'}`}>
                    {t.content}
                  </p>
                  {(t.cards?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
                      {t.cards!.map((c, j) => <EntityCardRow key={`${i}-${j}`} card={c}/>)}
                    </div>
                  )}
                  {(t.cards ?? []).some(c => c.kind === 'event') && (
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      {planSaves[i]?.status === 'saved' ? (
                        <Link
                          href={`/plan/${(planSaves[i] as { planId: string }).planId}`}
                          className="press-haptic inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--v4-go,#22c55e)] text-[#0a0a0c] text-[12.5px] font-semibold"
                        >
                          Plan gespeichert — öffnen
                        </Link>
                      ) : planSaves[i]?.status === 'auth' ? (
                        <Link
                          href="/auth/login"
                          className="press-haptic inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)] text-[12.5px] font-semibold"
                        >
                          Zum Speichern bitte anmelden
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => savePlan(i)}
                          disabled={planSaves[i]?.status === 'saving'}
                          className="press-haptic inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold disabled:opacity-40"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
                          </svg>
                          {planSaves[i]?.status === 'saving' ? 'Speichert …' : 'Als Plan speichern'}
                        </button>
                      )}
                      {planSaves[i]?.status === 'error' && (
                        <span className="text-[11.5px] text-[var(--v4-alert)]">Speichern fehlgeschlagen — nochmal probieren.</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Streaming-Draft */}
      {streaming && (
        <div className="mb-3">
          <p className="text-[14px] leading-[1.55] text-[var(--v4-ink)] whitespace-pre-wrap break-words">
            {draft}
            <span className="inline-block w-[7px] h-[15px] ml-0.5 align-middle bg-[var(--v4-match)] animate-pulse"/>
          </p>
          {draftCards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
              {draftCards.map((c, j) => <EntityCardRow key={`d-${j}`} card={c}/>)}
            </div>
          )}
        </div>
      )}

      {/* Follow-up-Chips */}
      {!streaming && (
        <div className="flex flex-wrap gap-2 mb-3">
          {FOLLOWUP_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => sendMessage(chip, true)}
              className="press-haptic px-3 py-1.5 rounded-full text-[12px] text-[var(--v4-ink-70)] bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] hover:text-[var(--v4-ink)]"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Eingabe */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(input, false); }}
        className="relative"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={600}
          placeholder="Antworte dem Concierge — z. B. „lieber was Ruhigeres“ …"
          className="w-full px-4 py-3 pr-24 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[13.5px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="press-haptic absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold disabled:opacity-40"
        >
          Senden
        </button>
      </form>
    </div>
  );
}
