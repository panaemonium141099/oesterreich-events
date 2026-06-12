'use client';
import { useCallback, useEffect, useState } from 'react';

interface Draft { id: string; subject: string; body: string }
interface Prospect {
  id: string; domain: string; kind: string; org_name: string | null;
  email: string | null; bundesland: string | null; status: string;
  source_event_ids: string[]; draft: Draft | null;
}

const FILTERS = ['drafted', 'enriched', 'discovered', 'sent', 'skipped', ''] as const;
const LABEL: Record<string, string> = {
  drafted: 'Entwurf bereit', enriched: 'Angereichert', discovered: 'Entdeckt',
  sent: 'Gesendet', skipped: 'Übersprungen', '': 'Alle',
};

export default function OutreachPage() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('drafted');

  const load = useCallback((status: string) => {
    setLoading(true);
    const qs = status ? `?status=${status}` : '';
    fetch(`/api/admin/outreach${qs}`)
      .then((r) => r.json())
      .then((d) => setRows(d.prospects ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Outreach</h1>
      <p className="text-white/50 mb-4 text-sm">{rows.length} Prospects</p>

      <MentionsPanel />

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f || 'all'}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm ${filter === f ? 'bg-amber-400 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}
          >
            {LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white/40">Lädt…</p>
      ) : rows.length === 0 ? (
        <p className="text-white/40">Keine Prospects in diesem Status.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((p) => (
            <ProspectCard key={p.id} p={p} onChanged={() => load(filter)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProspectCard({ p, onChanged }: { p: Prospect; onChanged: () => void }) {
  const [subject, setSubject] = useState(p.draft?.subject ?? '');
  const [body, setBody] = useState(p.draft?.body ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  async function call(path: string, init: RequestInit, label: string) {
    setBusy(label);
    try {
      const r = await fetch(path, init);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error ?? 'Fehler'); return false; }
      return true;
    } finally { setBusy(null); }
  }

  const patch = (payload: object, label: string) =>
    call(`/api/admin/outreach/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }, label);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <a href={`https://${p.domain}`} target="_blank" rel="noopener noreferrer nofollow" className="text-amber-400 hover:underline font-medium">{p.domain}</a>
          <div className="text-sm text-white/50">{p.org_name ?? '—'}{p.bundesland ? ` · ${p.bundesland}` : ''}</div>
          <div className="text-sm">{p.email ? <span className="text-white/70">{p.email}</span> : <span className="text-red-400/70">kein Kontakt</span>}{p.source_event_ids?.length ? ` · ${p.source_event_ids.length} Events` : ''}</div>
        </div>
        <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-white/[0.06] text-white/60">{LABEL[p.status] ?? p.status}</span>
      </div>

      {p.draft ? (
        <>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full mb-2 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm" placeholder="Betreff" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm font-mono leading-relaxed" />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!p.email || !!busy || p.status === 'sent'}
              onClick={async () => {
                if (subject !== p.draft?.subject || body !== p.draft?.body) await patch({ action: 'edit', subject, body }, 'save');
                if (!confirm(`E-Mail wirklich an ${p.email} senden?`)) return;
                if (await call(`/api/admin/outreach/${p.id}/send`, { method: 'POST' }, 'send')) onChanged();
              }}
              className="px-4 py-2 rounded-lg bg-amber-400 text-black text-sm font-semibold disabled:opacity-40"
            >{busy === 'send' ? 'Sende…' : 'Senden'}</button>
            <button disabled={!!busy} onClick={async () => { if (await patch({ action: 'edit', subject, body }, 'save')) onChanged(); }}
              className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/70 text-sm disabled:opacity-40">Speichern</button>
            <button disabled={!!busy} onClick={async () => { if (await patch({ action: 'skip' }, 'skip')) onChanged(); }}
              className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/50 text-sm disabled:opacity-40">Überspringen</button>
            <button disabled={!!busy} onClick={async () => { if (confirm(`${p.domain} dauerhaft sperren?`) && await patch({ action: 'suppress' }, 'suppress')) onChanged(); }}
              className="px-4 py-2 rounded-lg text-red-400/70 hover:text-red-400 text-sm disabled:opacity-40">Sperren</button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <span className="text-sm text-white/40 py-2">Noch kein Entwurf.</span>
          <button disabled={!!busy} onClick={async () => { if (await patch({ action: 'skip' }, 'skip')) onChanged(); }}
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 text-sm">Überspringen</button>
        </div>
      )}
    </div>
  );
}

interface Mention { id: string; url: string; domain: string; kind: string; source: string; is_new: boolean }

function MentionsPanel() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  useEffect(() => {
    fetch('/api/admin/outreach/mentions').then((r) => r.json())
      .then((d) => setMentions(d.mentions ?? [])).catch(() => {});
  }, []);
  if (mentions.length === 0) return null;
  const newCount = mentions.filter((m) => m.is_new).length;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-6">
      <div className="text-sm font-semibold mb-2">
        Erwähnungen &amp; Backlinks <span className="text-white/40">({mentions.length}{newCount ? `, ${newCount} neu` : ''})</span>
      </div>
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {mentions.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-sm">
            {m.is_new && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-black font-semibold shrink-0">NEU</span>}
            <a href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="text-amber-400 hover:underline truncate">{m.domain}</a>
            <span className="text-white/30 text-xs shrink-0">{m.kind} · {m.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
