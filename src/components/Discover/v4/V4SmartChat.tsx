'use client';

/**
 * V4SmartChat — der Smart-Tab als EIN durchgehender Concierge-Chat
 * (fn-19 Phase B, Rework nach User-Feedback: vorher waren Suchleiste und
 * Chat-Panel getrennte Flächen — "unsauber, sollte nicht getrennt sein").
 *
 * Ablauf: EIN Composer. Jede Nachricht (auch die erste) geht an
 * /api/search/chat — Gemini sucht per Function-Calling in der DB
 * (runSmartSearch) und antwortet mit Text + Entity-Karten. Bei breiten/
 * persönlichen Anfragen (Date, Gruppenausflug) fragt die KI erst nach
 * Alter/Interessen/Zeitraum, bevor sie sucht (System-Prompt-Regel).
 *
 * Timeline statt Alles-oder-Nichts: jede Karte hat einen Auswahl-Toggle.
 * Ausgewählte Vorschläge sammeln sich — über alle Chat-Runden hinweg —
 * in der Timeline-Leiste (Events nach Startzeit sortiert, Aktivitäten
 * als flexible Zwischenstopps) und werden von dort als Plan gespeichert
 * (POST /api/plans: Events in Timeline-Reihenfolge = plan_items-Position,
 * Aktivitäten als verlinkte Zeilen in der Notiz).
 *
 * Verlauf ist rein client-seitig (Server stateless); neue initialQuery
 * (URL-Deep-Link ?q=) startet eine frische Session.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { ChatEntityCard, ChatEventCard, ChatActivityCard, ChatSuggestionCard } from '@/lib/search/chat-cards';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  cards?: ChatEntityCard[];
  isError?: boolean;
}

type PlanSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; planId: string }
  | { status: 'auth' }
  | { status: 'error' };

const SAMPLE_QUERIES = [
  'Ich bin Student und will heute abend billig saufen gehen',
  'Plan mir ein Date für Samstag',
  'Gratis Familienausflug am Wochenende',
  'Was tun bei Regen in Graz?',
  'Techno-Party am Wochenende',
  'Mach mir einen Tagesplan für Salzburg',
];

const FOLLOWUP_CHIPS = ['Eher indoor', 'Günstiger bitte', 'Mit Kindern', 'Lieber am Abend', 'Mach mir einen Tagesplan'];

function cardKey(card: ChatEntityCard): string {
  if (card.kind === 'event') return `event:${card.id}`;
  if (card.kind === 'activity') return `activity:${card.slug}`;
  return `suggestion:${card.id}`;
}

function eventHref(ev: ChatEventCard): string {
  return buildEventUrlV2({
    id: ev.id, slug: ev.slug, start_date: ev.start_date,
    postal_code: ev.postal_code, address: ev.address,
    bundesland: ev.bundesland, location_name: ev.location_name,
  });
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function SelectToggle({
  selected,
  title,
  onClick,
}: {
  selected: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={selected ? `${title} aus der Timeline entfernen` : `${title} zur Timeline hinzufügen`}
      title={selected ? 'Aus der Timeline entfernen' : 'Zur Timeline hinzufügen'}
      className={`press-haptic absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
        selected
          ? 'bg-[var(--v4-match)] border-[var(--v4-match)] text-[#0a0a0c]'
          : 'bg-[var(--v4-surface-elevated)] border-[var(--v4-hairline-3)] text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]'
      }`}
    >
      {selected ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      )}
    </button>
  );
}

function EntityCard({
  card,
  selected,
  onToggle,
}: {
  card: ChatEntityCard;
  selected: boolean;
  onToggle: (card: ChatEntityCard) => void;
}) {
  // fn-19 Tipp-Karten: freie Concierge-Idee — keine Detailseite, kein
  // Link; nur Titel + Auswahl-Toggle für die Timeline.
  if (card.kind === 'suggestion') {
    const s = card as ChatSuggestionCard;
    return (
      <div className="relative">
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[rgba(245,185,66,0.4)] bg-[rgba(245,185,66,0.06)] p-2 pr-12">
          <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(245,185,66,0.14)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v4-match)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--v4-match)]">Concierge-Idee</p>
            <p className="text-[13.5px] font-semibold text-[var(--v4-ink)] leading-tight line-clamp-2">{s.title}</p>
          </div>
        </div>
        <SelectToggle selected={selected} title={s.title} onClick={() => onToggle(card)}/>
      </div>
    );
  }

  const isEvent = card.kind === 'event';
  const ev = card as ChatEventCard;
  const act = card as ChatActivityCard;
  const href = isEvent ? eventHref(ev) : `/aktivitaet/${act.slug}`;
  const title = isEvent ? ev.title : act.name;
  const meta = isEvent
    ? [formatEventDate(ev.start_date), ev.location_name].filter(Boolean).join(' · ')
    : [act.town, act.setting === 'indoor' ? 'Indoor' : act.setting === 'outdoor' ? 'Outdoor' : null]
        .filter(Boolean).join(' · ');
  const image = card.image_url;

  return (
    <div className="relative">
      <Link
        href={href}
        data-track="chat_entity_click"
        data-track-id={isEvent ? ev.id : act.slug}
        data-track-provider={card.kind}
        className="press-haptic flex items-center gap-3 rounded-xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors p-2 pr-12"
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
      <SelectToggle selected={selected} title={title} onClick={() => onToggle(card)}/>
    </div>
  );
}

export function V4SmartChat({ initialQuery = '' }: { initialQuery?: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [draftCards, setDraftCards] = useState<ChatEntityCard[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [selection, setSelection] = useState<Record<string, ChatEntityCard>>({});
  const [planSave, setPlanSave] = useState<PlanSaveState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef<string | null>(null);
  // turns als Ref mitführen, damit sendMessage nie auf veraltetem State
  // aufsetzt (Auto-Send + schnelle Chip-Klicks).
  const turnsRef = useRef<ChatTurn[]>([]);

  function commitTurns(next: ChatTurn[]) {
    turnsRef.current = next;
    setTurns(next);
  }

  async function sendMessage(text: string, viaChip: boolean) {
    const msg = text.trim();
    if (!msg || streaming) return;
    const isFirst = turnsRef.current.length === 0;
    trackEvent('chat_message', { followup: !isFirst, chip: viaChip });
    if (isFirst) trackEvent('smart_search', { query: msg, mode: 'chat' });

    const nextTurns: ChatTurn[] = [...turnsRef.current, { role: 'user', content: msg }];
    commitTurns(nextTurns);
    setInput('');
    setDraft('');
    setDraftCards([]);
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const apiMessages = nextTurns.slice(-11).map(t => ({ role: t.role, content: t.content }));

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
      commitTurns([...turnsRef.current, { role: 'assistant', content: acc.trim(), cards }]);
    } else {
      commitTurns([...turnsRef.current, {
        role: 'assistant',
        content: commitErr ?? 'Keine Antwort — probier es nochmal.',
        isError: true,
      }]);
    }
  }

  // Deep-Link (?q=…) startet eine frische Session — auch wenn sich die
  // Query per Top-Nav/CTA ändert, während der Tab schon offen ist.
  useEffect(() => {
    const q = initialQuery.trim();
    if (!q || autoSentRef.current === q) return;
    autoSentRef.current = q;
    abortRef.current?.abort();
    commitTurns([]);
    setSelection({});
    setPlanSave({ status: 'idle' });
    void sendMessage(q, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  function toggleSelect(card: ChatEntityCard) {
    const key = cardKey(card);
    setSelection(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = card;
        trackEvent('chat_entity_select', {
          kind: card.kind,
          id: card.kind === 'activity' ? card.slug : card.id,
        });
      }
      return next;
    });
    setPlanSave(p => (p.status === 'saved' ? { status: 'idle' } : p));
  }

  const selectedCards = Object.values(selection);
  const selectedEvents = selectedCards
    .filter((c): c is ChatEventCard => c.kind === 'event')
    .sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  const selectedActivities = selectedCards.filter((c): c is ChatActivityCard => c.kind === 'activity');
  const selectedSuggestions = selectedCards.filter((c): c is ChatSuggestionCard => c.kind === 'suggestion');

  async function saveTimelineAsPlan() {
    if (selectedCards.length === 0) return;
    setPlanSave({ status: 'saving' });
    trackEvent('chat_save_plan', {
      events: selectedEvents.length,
      activities: selectedActivities.length,
      suggestions: selectedSuggestions.length,
    });

    const firstUserMsg = turnsRef.current.find(t => t.role === 'user')?.content ?? 'Concierge';
    const noteParts: string[] = [];
    if (selectedActivities.length > 0) {
      noteParts.push('Flexible Stopps vom Concierge:\n' + selectedActivities
        .map(a => `- ${a.name}${a.town ? ` (${a.town})` : ''} → https://lasstreffen.at/aktivitaet/${a.slug}`)
        .join('\n'));
    }
    if (selectedSuggestions.length > 0) {
      noteParts.push('Ideen vom Concierge:\n' + selectedSuggestions
        .map(s => `- ${s.title}`)
        .join('\n'));
    }
    const note = noteParts.length > 0 ? noteParts.join('\n\n') : null;

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `KI-Plan: ${firstUserMsg.slice(0, 60)}`,
          plan_date: selectedEvents[0]?.start_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          note,
          event_ids: selectedEvents.map(e => e.id),
        }),
      });
      if (res.status === 401) {
        setPlanSave({ status: 'auth' });
      } else if (res.ok) {
        const { plan } = await res.json();
        setPlanSave({ status: 'saved', planId: plan.id });
      } else {
        setPlanSave({ status: 'error' });
      }
    } catch {
      setPlanSave({ status: 'error' });
    }
  }

  const hasConversation = turns.length > 0 || streaming;

  return (
    <div className="max-w-[860px] mx-auto px-4 md:px-14 pb-24">
      {/* Intro nur solange kein Gespräch läuft */}
      {!hasConversation && (
        <div className="mt-6 mb-6 text-center">
          <h2 className="text-[22px] md:text-[28px] font-bold tracking-[-0.02em] text-[var(--v4-ink)] mb-2">
            Was hast du vor?
          </h2>
          <p className="text-[13px] text-[var(--v4-ink-50)] max-w-[48ch] mx-auto">
            Plan gemeinsam mit dem Concierge — er sucht live in allen Events &amp; Ausflugszielen Österreichs und du speicherst das Beste als Plan.
          </p>
        </div>
      )}

      {/* Verlauf */}
      {turns.length > 0 && (
        <div className="flex flex-col gap-4 mt-4 mb-4">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'self-end max-w-[85%]' : 'self-start w-full'}>
              {t.role === 'user' ? (
                <p className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[14px] text-[var(--v4-ink)]">
                  {t.content}
                </p>
              ) : (
                <div className="rounded-2xl border p-4" style={{ background: 'rgba(245,185,66,0.05)', borderColor: 'rgba(245,185,66,0.22)' }}>
                  <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-match)] mb-1.5">
                    Concierge
                  </p>
                  <p className={`text-[14px] leading-[1.55] whitespace-pre-wrap break-words ${t.isError ? 'text-[var(--v4-ink-50)]' : 'text-[var(--v4-ink)]'}`}>
                    {t.content}
                  </p>
                  {(t.cards?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                      {t.cards!.map((c, j) => (
                        <EntityCard key={`${i}-${j}`} card={c} selected={!!selection[cardKey(c)]} onToggle={toggleSelect}/>
                      ))}
                    </div>
                  )}
                  {(t.cards?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-[var(--v4-ink-30)] mt-2">
                      Mit + baust du dir aus den Vorschlägen deine Timeline.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Streaming-Draft */}
      {streaming && (
        <div className="rounded-2xl border p-4 mb-4" style={{ background: 'rgba(245,185,66,0.05)', borderColor: 'rgba(245,185,66,0.22)' }}>
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-match)] mb-1.5">Concierge</p>
          <p className="text-[14px] leading-[1.55] text-[var(--v4-ink)] whitespace-pre-wrap break-words">
            {draft}
            <span className="inline-block w-[7px] h-[15px] ml-0.5 align-middle bg-[var(--v4-match)] animate-pulse"/>
          </p>
          {draftCards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {draftCards.map((c, j) => (
                <EntityCard key={`d-${j}`} card={c} selected={!!selection[cardKey(c)]} onToggle={toggleSelect}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline-Leiste: die persönliche Auswahl über alle Runden */}
      {selectedCards.length > 0 && (
        <div className="rounded-2xl border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] p-4 mb-4">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2.5">
            Deine Timeline ({selectedCards.length})
          </p>
          <ol className="flex flex-col gap-1.5 mb-3">
            {selectedEvents.map(e => (
              <li key={`sel-e-${e.id}`} className="flex items-center gap-2.5 text-[13px] text-[var(--v4-ink)]">
                <span className="text-[11px] font-semibold text-[var(--v4-match)] whitespace-nowrap w-[118px] flex-shrink-0">
                  {formatEventDate(e.start_date)}
                </span>
                <span className="line-clamp-1 flex-1">{e.title}</span>
                <button
                  type="button"
                  onClick={() => toggleSelect(e)}
                  aria-label={`${e.title} entfernen`}
                  className="press-haptic text-[var(--v4-ink-30)] hover:text-[var(--v4-alert)] flex-shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </li>
            ))}
            {selectedActivities.map(a => (
              <li key={`sel-a-${a.slug}`} className="flex items-center gap-2.5 text-[13px] text-[var(--v4-ink)]">
                <span className="text-[11px] font-semibold text-[var(--v4-ink-50)] whitespace-nowrap w-[118px] flex-shrink-0">
                  flexibel
                </span>
                <span className="line-clamp-1 flex-1">{a.name}</span>
                <button
                  type="button"
                  onClick={() => toggleSelect(a)}
                  aria-label={`${a.name} entfernen`}
                  className="press-haptic text-[var(--v4-ink-30)] hover:text-[var(--v4-alert)] flex-shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </li>
            ))}
            {selectedSuggestions.map(s => (
              <li key={`sel-s-${s.id}`} className="flex items-center gap-2.5 text-[13px] text-[var(--v4-ink)]">
                <span className="text-[11px] font-semibold text-[var(--v4-match)] whitespace-nowrap w-[118px] flex-shrink-0">
                  Idee
                </span>
                <span className="line-clamp-1 flex-1">{s.title}</span>
                <button
                  type="button"
                  onClick={() => toggleSelect(s)}
                  aria-label={`${s.title} entfernen`}
                  className="press-haptic text-[var(--v4-ink-30)] hover:text-[var(--v4-alert)] flex-shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 flex-wrap">
            {planSave.status === 'saved' ? (
              <Link
                href={`/plan/${planSave.planId}`}
                className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--v4-go,#22c55e)] text-[#0a0a0c] text-[13px] font-semibold"
              >
                Plan gespeichert — öffnen
              </Link>
            ) : planSave.status === 'auth' ? (
              <Link
                href="/auth/login"
                className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)] text-[13px] font-semibold"
              >
                Zum Speichern bitte anmelden
              </Link>
            ) : (
              <button
                type="button"
                onClick={saveTimelineAsPlan}
                disabled={planSave.status === 'saving'}
                className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13px] font-semibold disabled:opacity-40"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
                </svg>
                {planSave.status === 'saving' ? 'Speichert …' : 'Timeline als Plan speichern'}
              </button>
            )}
            {planSave.status === 'error' && (
              <span className="text-[11.5px] text-[var(--v4-alert)]">Speichern fehlgeschlagen — nochmal probieren.</span>
            )}
          </div>
        </div>
      )}

      {/* Chips: Starter vor dem ersten Turn, Verfeinerungen danach */}
      {!streaming && (
        <div className="mb-3">
          {turns.length === 0 ? (
            <>
              <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2">Probier mal:</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUERIES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s, true)}
                    data-track="smart_sample_click"
                    data-track-id={s}
                    className="press-haptic text-left px-3 py-2 rounded-lg text-[12px] text-[var(--v4-ink-70)] bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] hover:text-[var(--v4-ink)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      {/* Composer — die EINE Eingabe für alles */}
      <form onSubmit={e => { e.preventDefault(); sendMessage(input, false); }}>
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            maxLength={600}
            placeholder={turns.length === 0
              ? 'Was hast du vor? Tipp ein in Alltagssprache …'
              : 'Antworte dem Concierge …'}
            className="w-full px-5 py-4 pr-28 rounded-2xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
            autoFocus={!initialQuery}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="press-haptic absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {streaming ? '…' : 'Senden'}
          </button>
        </div>
        <p className="text-[11px] text-[var(--v4-ink-30)] mt-2 px-1">
          KI-Suche über alle Events &amp; Ausflugsziele Österreichs — jede Empfehlung kommt direkt aus unserer Datenbank.
        </p>
      </form>
    </div>
  );
}
