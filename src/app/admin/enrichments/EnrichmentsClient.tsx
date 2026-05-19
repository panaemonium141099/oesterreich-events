'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, CheckCheck, X, Loader2, ExternalLink, ImageOff, RefreshCw, Eye } from 'lucide-react';
import type { EnrichmentProposal } from '@/app/api/admin/enrichments/route';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

type StatusFilter = 'pending' | 'approved' | 'declined';

interface ListResponse {
  items: EnrichmentProposal[];
  counts: { pending: number; approved: number; declined: number };
}

export default function EnrichmentsPage() {
  const [items, setItems] = useState<EnrichmentProposal[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, declined: 0 });
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/enrichments?status=${status}&limit=100`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as ListResponse;
      setItems(data.items);
      setCounts(data.counts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = useCallback(
    async (id: string) => {
      if (!confirm('Vorschlag annehmen und auf Event übernehmen?')) return;
      setBusyId(id);
      try {
        const r = await fetch(`/api/admin/enrichments/${id}/approve`, { method: 'POST' });
        if (!r.ok) {
          const e = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          alert(`Fehler: ${e.error ?? r.status}`);
          return;
        }
        setItems((prev) => prev.filter((p) => p.id !== id));
        setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), approved: c.approved + 1 }));
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const handleApproveAll = useCallback(async () => {
    if (items.length === 0) return;
    if (!confirm(`Alle ${items.length} offenen Vorschläge ANNEHMEN und auf Events übernehmen?`)) {
      return;
    }
    setBulkBusy(true);
    try {
      const r = await fetch(`/api/admin/enrichments/approve-all`, { method: 'POST' });
      const data = (await r.json().catch(() => ({}))) as {
        approved?: number;
        failed?: number;
        errors?: Array<{ id: string; message: string }>;
        error?: string;
      };
      if (!r.ok) {
        alert(`Fehler: ${data.error ?? r.status}`);
        return;
      }
      const summary = `${data.approved ?? 0} angenommen` +
        (data.failed && data.failed > 0 ? `, ${data.failed} fehlgeschlagen` : '');
      alert(summary);
      await load();
    } finally {
      setBulkBusy(false);
    }
  }, [items.length, load]);

  const handleDecline = useCallback(async (id: string) => {
    const reason = prompt('Grund (optional)?') ?? '';
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/enrichments/${id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        alert(`Fehler: ${e.error ?? r.status}`);
        return;
      }
      setItems((prev) => prev.filter((p) => p.id !== id));
      setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), declined: c.declined + 1 }));
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Enrichments
          </h1>
          <p className="text-sm text-white/50 mt-1">
            AI-Agent-Vorschläge für fehlende Event-Felder. Approve übernimmt nur die NICHT-leeren
            Felder, Decline lässt das Event unverändert.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'pending' && items.length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={loading || bulkBusy}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg disabled:opacity-50"
              title={`Alle ${items.length} offenen Vorschläge annehmen`}
            >
              {bulkBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              Approve all ({items.length})
            </button>
          )}
          <button
            onClick={load}
            disabled={loading || bulkBusy}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'declined'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              status === s
                ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'
            }`}
          >
            {s === 'pending' ? 'Pending' : s === 'approved' ? 'Approved' : 'Declined'}
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-white/[0.06]">
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 border border-red-500/20 bg-red-500/10 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="py-16 text-center text-white/40 text-sm">
          Keine {status === 'pending' ? 'offenen' : status === 'approved' ? 'genehmigten' : 'abgelehnten'} Vorschläge.
        </div>
      )}

      <div className="space-y-4">
        {items.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            busy={busyId === p.id}
            onApprove={() => handleApprove(p.id)}
            onDecline={() => handleDecline(p.id)}
            readOnly={status !== 'pending'}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal card
// ---------------------------------------------------------------------------

interface ProposalCardProps {
  proposal: EnrichmentProposal;
  busy: boolean;
  readOnly: boolean;
  onApprove: () => void;
  onDecline: () => void;
}

function ProposalCard({ proposal, busy, readOnly, onApprove, onDecline }: ProposalCardProps) {
  const e = proposal.event;
  const changedFields = useMemo(() => {
    const f: Array<'category' | 'image_url' | 'description' | 'price_text' | 'tags'> = [];
    if (proposal.proposed_category !== null) f.push('category');
    if (proposal.proposed_image_url !== null) f.push('image_url');
    if (proposal.proposed_description !== null) f.push('description');
    if (proposal.proposed_price_text !== null) f.push('price_text');
    if (proposal.proposed_tags !== null) f.push('tags');
    return f;
  }, [proposal]);

  if (!e) {
    return (
      <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg text-sm text-red-400">
        Event {proposal.event_id} nicht gefunden (gelöscht?). Proposal-ID {proposal.id}.
      </div>
    );
  }

  return (
    <article className="border border-white/[0.06] bg-white/[0.02] rounded-xl overflow-hidden">
      {/* Header: event meta */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white truncate">
            <a
              href={buildEventUrlV2(e)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-400 hover:underline inline-flex items-center gap-1.5"
              title="Event-Seite öffnen"
            >
              {e.title}
              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
            </a>
          </h2>
          <div className="text-xs text-white/40 mt-1 flex items-center gap-2 flex-wrap">
            <span>{new Date(e.start_date).toLocaleDateString('de-AT')}</span>
            {e.location_name && <span>· {e.location_name}</span>}
            {e.bundesland && <span>· {e.bundesland}</span>}
            {e.source_name && <span>· {e.source_name}</span>}
            {e.source_url && (
              <a
                href={e.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-400/70 hover:text-amber-400"
              >
                Quelle <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={buildEventUrlV2(e)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-white/70 hover:text-white rounded-lg"
            title="Vollständige Event-Seite öffnen"
          >
            <Eye className="w-4 h-4" />
            Ansehen
          </a>
          {!readOnly && (
            <>
              <button
                onClick={onDecline}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Decline
              </button>
              <button
                onClick={onApprove}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve
              </button>
            </>
          )}
        </div>
      </div>

      {/* Diff body */}
      <div className="p-5 space-y-5">
        {changedFields.includes('category') && (
          <FieldDiff
            label="Kategorie"
            before={e.category}
            after={proposal.proposed_category}
          />
        )}

        {changedFields.includes('image_url') && (
          <ImageDiff
            before={e.image_url}
            after={proposal.proposed_image_url}
            source={proposal.image_source}
          />
        )}

        {changedFields.includes('description') && (
          <FieldDiff
            label="Beschreibung"
            before={e.description}
            after={proposal.proposed_description}
            multiline
          />
        )}

        {changedFields.includes('price_text') && (
          <div className="space-y-2">
            <FieldDiff label="Preis" before={e.price_text} after={proposal.proposed_price_text} />
            {(proposal.proposed_price_min !== null || proposal.proposed_price_max !== null) && (
              <div className="text-xs text-white/40">
                Spanne: {proposal.proposed_price_min ?? '?'} – {proposal.proposed_price_max ?? '?'} €
                {(e.price_min !== null || e.price_max !== null) && (
                  <span className="ml-2 text-white/30">
                    (vorher: {e.price_min ?? '?'} – {e.price_max ?? '?'})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {changedFields.includes('tags') && (
          <FieldDiff
            label="Tags"
            before={e.tags?.join(', ') ?? null}
            after={proposal.proposed_tags?.join(', ') ?? null}
          />
        )}

        {proposal.agent_reasoning && (
          <details className="text-xs text-white/40 border-t border-white/[0.04] pt-3">
            <summary className="cursor-pointer hover:text-white/60">Agent-Reasoning</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{proposal.agent_reasoning}</p>
          </details>
        )}

        {readOnly && proposal.decline_reason && (
          <div className="text-xs text-red-400/70 border-t border-white/[0.04] pt-3">
            Decline-Grund: {proposal.decline_reason}
          </div>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Diff sub-components
// ---------------------------------------------------------------------------

function ImageDiff({
  before,
  after,
  source,
}: {
  before: string | null;
  after: string | null;
  source: string | null;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-white/60 mb-2 flex items-center gap-2">
        Bild
        {source && (
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/10 text-amber-400 rounded">
            {source}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ImagePane label="Vorher" url={before} />
        <ImagePane label="Nachher" url={after} highlight />
      </div>
    </div>
  );
}

function ImagePane({ label, url, highlight }: { label: string; url: string | null; highlight?: boolean }) {
  return (
    <div
      className={`border rounded-lg overflow-hidden bg-white/[0.02] ${
        highlight ? 'border-emerald-500/30' : 'border-white/[0.06]'
      }`}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-white/40 border-b border-white/[0.04]">
        {label}
      </div>
      <div className="aspect-video flex items-center justify-center bg-black/30 relative">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="max-w-full max-h-full object-contain"
            onError={(ev) => {
              (ev.currentTarget as HTMLImageElement).style.display = 'none';
              const sib = ev.currentTarget.nextElementSibling as HTMLElement | null;
              if (sib) sib.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`absolute inset-0 ${url ? 'hidden' : 'flex'} items-center justify-center text-white/30 flex-col gap-1`}
        >
          <ImageOff className="w-6 h-6" />
          <span className="text-xs">{url ? 'Fehler beim Laden' : 'Kein Bild'}</span>
        </div>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-1.5 text-[10px] text-white/40 hover:text-amber-400 truncate border-t border-white/[0.04]"
          title={url}
        >
          {url}
        </a>
      )}
    </div>
  );
}

function FieldDiff({
  label,
  before,
  after,
  multiline,
}: {
  label: string;
  before: string | null;
  after: string | null;
  multiline?: boolean;
}) {
  const Box = ({ value, tone }: { value: string | null; tone: 'before' | 'after' }) => (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        tone === 'after'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-white/[0.06] bg-white/[0.02]'
      } ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}
    >
      {value ?? <span className="text-white/30 italic">(leer)</span>}
    </div>
  );
  return (
    <div>
      <div className="text-xs font-medium text-white/60 mb-2">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Vorher</div>
          <Box value={before} tone="before" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Nachher</div>
          <Box value={after} tone="after" />
        </div>
      </div>
    </div>
  );
}
