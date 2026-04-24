'use client';

/**
 * /admin/seo/experiments — manage SEO A/B experiments.
 *
 * Landing strip: list of all experiments with status pill + impression
 * counts, sortable by started_at DESC. Each row expands to show the
 * variant payloads + a "Pause / Resume / Conclude" action row.
 *
 * Create-form is a simple single-experiment form — scope picker, two
 * variant payload editors (JSON textareas with a live preview of the
 * rendered title for known placeholders).
 *
 * MVP scope: we intentionally don't ship statistical-significance
 * auto-detection — the admin eyeballs impressions + GSC clicks per
 * period and declares a winner manually. The winner selection is
 * recorded in the `winner` column for future reference.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Play, Pause, Flag, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';

interface Experiment {
  id: string;
  name: string;
  scope: 'gemeinde' | 'thema' | 'bundesland' | 'event_detail';
  status: 'running' | 'paused' | 'concluded';
  variant_a: Record<string, unknown>;
  variant_b: Record<string, unknown>;
  winner: 'A' | 'B' | null;
  split_b_pct: number;
  started_at: string;
  concluded_at: string | null;
  notes: string | null;
}

export default function SeoExperimentsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user && profile && profile.role !== 'god' && profile.role !== 'admin') {
      router.push('/map');
    }
  }, [authLoading, user, profile, router]);
  const isAdmin = !!profile && (profile.role === 'god' || profile.role === 'admin');

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/seo/experiments');
      const body = await res.json();
      setExperiments(body.experiments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (authLoading || !user || !profile) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/seo" className="text-white/40 hover:text-white/70">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-white/90">SEO Experimente</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90"
        >
          <Plus className="w-3.5 h-3.5" />
          Neu
        </button>
      </div>

      <p className="text-sm text-white/50 max-w-2xl">
        Zeitbasierte A/B-Rotation für Hub-Titel. Variante A läuft 14 Tage, dann B für 14 Tage, im Wechsel. Vergleiche dieselben 28-Tage-Fenster in Search Console um einen Gewinner zu deklarieren.
      </p>

      {loading ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] h-40 animate-pulse" />
      ) : experiments.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-12 text-center">
          <p className="text-sm text-white/50">Noch keine Experimente. Klick auf „Neu" um das erste zu erstellen.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {experiments.map(exp => (
            <ExperimentCard key={exp.id} exp={exp} onChanged={load} />
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateExperimentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function ExperimentCard({ exp, onChanged }: { exp: Experiment; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<{ A: number; B: number } | null>(null);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    fetch(`/api/admin/seo/experiments/${exp.id}`)
      .then(r => r.json())
      .then(j => setStats(j.stats?.impressions ?? null))
      .catch(() => {});
  }, [expanded, exp.id]);

  const patch = async (update: Record<string, unknown>) => {
    setMutating(true);
    try {
      const res = await fetch(`/api/admin/seo/experiments/${exp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      toast.success('Aktualisiert');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setMutating(false);
    }
  };

  const deleteExp = async () => {
    if (!confirm(`Experiment "${exp.name}" wirklich löschen? (Impressionen gehen verloren.)`)) return;
    setMutating(true);
    try {
      const res = await fetch(`/api/admin/seo/experiments/${exp.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      toast.success('Gelöscht');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setMutating(false);
    }
  };

  const statusColor = {
    running: 'bg-emerald-400/20 text-emerald-300',
    paused: 'bg-amber-400/20 text-amber-300',
    concluded: 'bg-white/10 text-white/50',
  }[exp.status];

  return (
    <li className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] text-left"
      >
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>
          {exp.status}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-white/40">{exp.scope}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 truncate">{exp.name}</p>
          <p className="text-xs text-white/40 mt-0.5">
            Seit {new Date(exp.started_at).toLocaleDateString('de-AT')}
            {exp.winner && <span className="ml-2 text-amber-300">· Gewinner: {exp.winner}</span>}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] text-sm">
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <VariantPreview label="Variante A" payload={exp.variant_a} count={stats?.A ?? null} />
            <VariantPreview label="Variante B" payload={exp.variant_b} count={stats?.B ?? null} />
          </div>

          {exp.notes && (
            <p className="mt-3 text-xs text-white/50 italic">{exp.notes}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {exp.status === 'running' && (
              <button
                disabled={mutating}
                onClick={() => patch({ status: 'paused' })}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
              >
                <Pause className="w-3 h-3" /> Pausieren
              </button>
            )}
            {exp.status === 'paused' && (
              <button
                disabled={mutating}
                onClick={() => patch({ status: 'running' })}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Resume
              </button>
            )}
            {exp.status !== 'concluded' && (
              <>
                <button
                  disabled={mutating}
                  onClick={() => patch({ status: 'concluded', winner: 'A' })}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  <Flag className="w-3 h-3" /> A wins
                </button>
                <button
                  disabled={mutating}
                  onClick={() => patch({ status: 'concluded', winner: 'B' })}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  <Flag className="w-3 h-3" /> B wins
                </button>
              </>
            )}
            <button
              disabled={mutating}
              onClick={deleteExp}
              className="ml-auto inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-400/10 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Löschen
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function VariantPreview({ label, payload, count }: { label: string; payload: Record<string, unknown>; count: number | null }) {
  return (
    <div className="rounded-lg bg-black/30 border border-white/[0.04] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
        {count !== null && (
          <span className="text-[10px] tabular-nums text-white/60">{count.toLocaleString('de-AT')} imp</span>
        )}
      </div>
      <pre className="text-[11px] text-white/70 font-mono whitespace-pre-wrap break-words">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

function CreateExperimentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'gemeinde' | 'thema' | 'bundesland' | 'event_detail'>('gemeinde');
  const [titleA, setTitleA] = useState('Events in {name} {plz} — {count} Veranstaltungen');
  const [titleB, setTitleB] = useState('{count} Events in {name} — Kalender für {plz}');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error('Name fehlt'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/seo/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          variant_a: { title_template: titleA },
          variant_b: { title_template: titleB },
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      toast.success('Experiment angelegt');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-[#141416] rounded-2xl border border-white/10 max-w-xl w-full p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Neues Experiment</h2>

        <label className="block">
          <span className="text-xs text-white/60 uppercase tracking-wider">Name</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm"
            placeholder="z.B. Gemeinde H1 — Stadtname vs. Klickbait"
          />
        </label>

        <label className="block">
          <span className="text-xs text-white/60 uppercase tracking-wider">Scope</span>
          <select
            value={scope}
            onChange={e => setScope(e.target.value as typeof scope)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm"
          >
            <option value="gemeinde">gemeinde</option>
            <option value="thema">thema</option>
            <option value="bundesland">bundesland</option>
            <option value="event_detail">event_detail</option>
          </select>
          <span className="text-[11px] text-white/40 mt-1 block">
            Platzhalter: {'{name}'}, {'{count}'}, {'{plz}'}, {'{bundesland}'}
          </span>
        </label>

        <label className="block">
          <span className="text-xs text-white/60 uppercase tracking-wider">Titel-Template A</span>
          <input
            type="text"
            value={titleA}
            onChange={e => setTitleA(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm font-mono"
          />
        </label>

        <label className="block">
          <span className="text-xs text-white/60 uppercase tracking-wider">Titel-Template B</span>
          <input
            type="text"
            value={titleB}
            onChange={e => setTitleB(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm font-mono"
          />
        </label>

        <label className="block">
          <span className="text-xs text-white/60 uppercase tracking-wider">Notizen (optional)</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm"
            placeholder="Hypothese, Erwartung …"
          />
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 text-white/60 hover:text-white"
          >Abbrechen</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? 'Lädt …' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
