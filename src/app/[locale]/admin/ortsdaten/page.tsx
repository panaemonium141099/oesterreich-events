'use client';

/**
 * Prüfansicht Ortsdaten (fn-25 O1): ungeklärte Fälle nach Quell-Spielstätte
 * gruppiert. Quellenbeleg (Rohname, Adresse, PLZ), Konfliktgrund, verworfene
 * Position und Karte in einer Ansicht, damit eine Prüfung viele
 * wiederkehrende Termine auf einmal klärt, ohne namensgleiche Orte zu
 * verschmelzen.
 */
import { useCallback, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

/**
 * Korrekturformular je Event: Position, Genauigkeit, Grund, Beleg. Die
 * Korrektur gilt nur für dieses Event und nur, solange die Quelle dieselben
 * Ortsangaben liefert (Verlegung → neue Entscheidung).
 */
function CorrectionForm({ sample, onDone }: { sample: Sample; onDone: () => void }) {
  const [lat, setLat] = useState(sample.latitude?.toString() ?? '');
  const [lng, setLng] = useState(sample.longitude?.toString() ?? '');
  const [precision, setPrecision] = useState('building');
  const [name, setName] = useState('');
  const [plz, setPlz] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/ortsdaten/correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: sample.id, latitude: Number(lat), longitude: Number(lng), precision,
          location_name: name || undefined, postal_code: plz || undefined, reason, evidence: evidence || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? 'Fehler'); return; }
      setMsg(json.written ? `Gespeichert: ${json.decision?.status} (${json.decision?.precision})` : `Korrektur gespeichert, Zeile nicht geschrieben (${json.skipped_reason ?? 'unverändert'})`);
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setBusy(false);
    }
  };

  const cls = 'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-xs';
  return (
    <div className="mt-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <input className={cls} placeholder="Breite (lat)" value={lat} onChange={e => setLat(e.target.value)} size={12} />
        <input className={cls} placeholder="Länge (lng)" value={lng} onChange={e => setLng(e.target.value)} size={12} />
        <select className={cls} value={precision} onChange={e => setPrecision(e.target.value)}>
          <option value="building">Gebäude</option>
          <option value="entrance">Eingang</option>
          <option value="site">Gelände/Treffpunkt</option>
          <option value="street">Straße</option>
        </select>
        <input className={cls} placeholder="Anzeigename (optional)" value={name} onChange={e => setName(e.target.value)} size={22} />
        <input className={cls} placeholder="PLZ (optional)" value={plz} onChange={e => setPlz(e.target.value)} size={6} />
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={cls} placeholder="Grund (Pflicht)" value={reason} onChange={e => setReason(e.target.value)} size={40} />
        <input className={cls} placeholder="Beleg (URL, Quelle)" value={evidence} onChange={e => setEvidence(e.target.value)} size={40} />
        <button disabled={busy || reason.trim().length < 5 || !lat || !lng} onClick={submit}
          className="text-xs px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50">Korrektur speichern</button>
      </div>
      {msg && <div className="text-xs">{msg}</div>}
    </div>
  );
}

function correctionIdOf(s: Sample): string | null {
  for (const e of s.location_resolution?.evidence ?? []) {
    const m = /^correction:([^:]+):/.exec(e);
    if (m) return m[1];
  }
  return null;
}

interface Sample {
  id: string;
  title: string;
  slug: string | null;
  source_url: string | null;
  start_date: string;
  location_name: string | null;
  location_name_raw: string | null;
  address_raw: string | null;
  address: string | null;
  postal_code: string | null;
  city_raw: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: string | null;
  location_resolution: { reasons?: string[]; rejected?: string[]; evidence?: string[]; revoked?: { latitude?: number; longitude?: number; geocoding_confidence?: string } | null } | null;
  publish_status: string | null;
}

interface Group {
  key: string;
  source_name: string;
  name: string;
  count: number;
  next_start: string;
  has_raw: number;
  reasons: string[];
  samples: Sample[];
}

const STATUS_LABEL: Record<string, string> = {
  conflict: 'Konflikt (widersprüchliche Angaben)',
  unresolved: 'Ungeklärt (kein belastbarer Ort)',
  region_only: 'Nur Bundesland bekannt',
  municipality_only: 'Nur Gemeinde belegt',
};

export default function OrtsdatenPage() {
  const [status, setStatus] = useState('conflict');
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const revoke = async (id: string) => {
    if (!confirm('Korrektur beenden und neu entscheiden?')) return;
    await fetch(`/api/admin/ortsdaten/correction?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, m] = await Promise.all([
        fetch(`/api/admin/ortsdaten?status=${status}&limit=100`).then(r => r.json()),
        fetch('/api/admin/ortsdaten?metrics=1').then(r => r.json()),
      ]);
      setGroups(g.groups ?? []);
      setTotal(g.total_events ?? 0);
      setMetrics(m.metrics ?? {});
    } catch {
      // still
    }
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('de-AT');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><MapPin className="w-6 h-6" /> Ortsdaten prüfen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Wissensstand der künftigen Events. Eine bestätigte Gemeinde ist kein bestätigter Veranstaltungsort; Pins und Anreise gibt es nur mit Beleg.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
        {[
          ['venue_confirmed', 'Venue belegt'], ['address_confirmed', 'Adresse belegt'], ['municipality_only', 'nur Gemeinde'],
          ['region_only', 'nur Bundesland'], ['unresolved', 'ungeklärt'], ['conflict', 'Konflikt'], ['online', 'online'], ['undecided', 'ohne Entscheidung'],
        ].map(([k, label]) => (
          <button key={k} onClick={() => k !== 'undecided' && k !== 'online' && setStatus(k)}
            className={`rounded-xl border p-3 text-left ${status === k ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-lg font-semibold">{fmt(metrics[k])}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{STATUS_LABEL[status] ?? status} · {fmt(total)} Events in {fmt(groups.length)} Gruppen (Top 100)</h2>
        <button onClick={load} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600">Aktualisieren</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Lade …</p>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.key} className="rounded-xl border border-gray-200 dark:border-gray-700">
              <button className="w-full text-left p-3 flex flex-wrap items-center gap-x-4 gap-y-1" onClick={() => setOpen(open === g.key ? null : g.key)}>
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-gray-500">{g.source_name}</span>
                <span className="text-xs rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5">×{g.count}</span>
                <span className="text-xs text-gray-500">nächster Termin {g.next_start.slice(0, 10)}</span>
                <span className="text-xs text-gray-500">{g.has_raw}/{g.count} mit Quellenstand</span>
                <span className="text-xs text-amber-700 dark:text-amber-400 truncate max-w-full">{g.reasons.slice(0, 3).join(' · ')}</span>
              </button>
              {open === g.key && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-3 text-sm">
                  {g.samples.map(s => (
                    <div key={s.id} className="grid md:grid-cols-2 gap-2">
                      <div>
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-gray-500">{s.start_date.slice(0, 16).replace('T', ' ')} · {s.publish_status}</div>
                        <div className="text-xs mt-1">Quelle sagt: <span className="font-mono">{s.location_name_raw ?? '∅'}</span>{s.address_raw ? ` · ${s.address_raw}` : ''}{s.postal_code ? ` · PLZ ${s.postal_code}` : ''}{s.city_raw ? ` · ${s.city_raw}` : ''}{s.bundesland ? ` · ${s.bundesland}` : ''}</div>
                        <div className="text-xs mt-1">Gründe: {(s.location_resolution?.reasons ?? []).join(', ') || '∅'}</div>
                        {(s.location_resolution?.rejected ?? []).length > 0 && <div className="text-xs">Verworfen: {(s.location_resolution?.rejected ?? []).join(', ')}</div>}
                        {(s.location_resolution?.evidence ?? []).length > 0 && <div className="text-xs">Belege: {(s.location_resolution?.evidence ?? []).join(', ')}</div>}
                        {s.location_resolution?.revoked?.latitude != null && (
                          <div className="text-xs">Alte Position: {s.location_resolution.revoked.latitude?.toFixed(4)}, {s.location_resolution.revoked.longitude?.toFixed(4)} ({s.location_resolution.revoked.geocoding_confidence ?? '∅'})</div>
                        )}
                      </div>
                      <div className="text-xs space-x-3">
                        <button className="underline" onClick={() => setEditing(editing === s.id ? null : s.id)}>Korrigieren</button>
                        {correctionIdOf(s) && <button className="underline" onClick={() => revoke(correctionIdOf(s)!)}>Korrektur beenden</button>}
                        {s.slug && <a className="underline" href={`/events/${s.id}`} target="_blank" rel="noreferrer">Event</a>}
                        {s.source_url && <a className="underline" href={s.source_url} target="_blank" rel="noreferrer">Quelle</a>}
                        {s.latitude != null && s.longitude != null && (
                          <a className="underline" href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=15/${s.latitude}/${s.longitude}`} target="_blank" rel="noreferrer">Karte</a>
                        )}
                        {s.address_raw && (
                          <a className="underline" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${s.address_raw} ${s.postal_code ?? ''} ${s.city_raw ?? ''}`)}`} target="_blank" rel="noreferrer">Adresse suchen</a>
                        )}
                        {editing === s.id && <CorrectionForm sample={s} onDone={() => { setEditing(null); load(); }} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
