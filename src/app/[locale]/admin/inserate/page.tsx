'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Check, X, ExternalLink, Loader2, Inbox } from 'lucide-react';

/**
 * /admin/inserate — Freigabe der öffentlich eingereichten Event-Inserate.
 *
 * Eine Einreichung wird hier nicht nur abgenickt, sondern vor der Freigabe
 * korrigierbar: Titel, Beschreibung, Ort und Links sind editierbar und
 * gehen als `edits` an die API. Ohne das wäre jede Schreibfehler-Korrektur
 * ein zweiter Handgriff in /admin/events, nachdem das Event bereits online
 * ist.
 *
 * Das Datum ist bewusst NICHT editierbar — eine Terminänderung ist keine
 * Korrektur, sondern ein anderes Event, und gehört zurück an den Inserenten.
 */

type Status = 'pending' | 'approved' | 'rejected';

interface Submission {
  id: string;
  status: Status;
  title: string;
  description: string | null;
  category: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  price_text: string | null;
  ticket_url: string | null;
  image_url: string | null;
  event_url: string | null;
  organizer: string | null;
  submitter_type: string;
  company: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  message: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  event_id: string | null;
  created_at: string;
}

const TABS: Array<[Status, string]> = [
  ['pending', 'Offen'],
  ['approved', 'Freigegeben'],
  ['rejected', 'Abgelehnt'],
];

/** Felder, die vor der Freigabe korrigiert werden dürfen.
 *  Schlüssel = camelCase-Name im API-Body, Spalte = Feld der Einreichung. */
const EDIT_FIELDS: Array<{
  key: string;
  column: keyof Submission;
  label: string;
  type?: 'textarea';
}> = [
  { key: 'title', column: 'title', label: 'Titel' },
  { key: 'description', column: 'description', label: 'Beschreibung', type: 'textarea' },
  { key: 'category', column: 'category', label: 'Kategorie' },
  { key: 'locationName', column: 'location_name', label: 'Veranstaltungsort' },
  { key: 'address', column: 'address', label: 'Adresse' },
  { key: 'postalCode', column: 'postal_code', label: 'PLZ' },
  { key: 'bundesland', column: 'bundesland', label: 'Bundesland' },
  { key: 'priceText', column: 'price_text', label: 'Eintritt' },
  { key: 'organizer', column: 'organizer', label: 'Veranstalter' },
  { key: 'eventUrl', column: 'event_url', label: 'Website' },
  { key: 'ticketUrl', column: 'ticket_url', label: 'Link zum Ticketverkauf' },
  { key: 'imageUrl', column: 'image_url', label: 'Link zum Bild' },
];

const INPUT =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-white/30 transition-colors';

function formatDateTime(iso: string, allDay: boolean): string {
  return new Date(iso).toLocaleString('de-AT', {
    timeZone: 'Europe/Vienna',
    dateStyle: 'medium',
    ...(allDay ? {} : { timeStyle: 'short' }),
  });
}

export default function AdminInseratePage() {
  const [tab, setTab] = useState<Status>('pending');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<Status, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/admin/event-submissions?status=${tab}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || 'Laden fehlgeschlagen');
        setSubmissions([]);
      } else {
        setSubmissions(data.submissions ?? []);
        setCounts(data.counts ?? { pending: 0, approved: 0, rejected: 0 });
      }
    } catch {
      setLoadError('Netzwerkfehler beim Laden.');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (submission: Submission) => {
    if (openId === submission.id) {
      setOpenId(null);
      return;
    }
    setOpenId(submission.id);
    setActionError('');
    setNote('');
    const initial: Record<string, string> = {};
    for (const field of EDIT_FIELDS) {
      initial[field.key] = (submission[field.column] as string | null) ?? '';
    }
    setEdits(initial);
  };

  const review = async (submission: Submission, action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) {
      setActionError('Bitte einen Ablehnungsgrund angeben. Er geht an den Inserenten.');
      return;
    }
    setBusyId(submission.id);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/event-submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note: note.trim() || null,
          ...(action === 'approve' ? { edits } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || 'Aktion fehlgeschlagen');
        return;
      }
      setOpenId(null);
      await load();
    } catch {
      setActionError('Netzwerkfehler.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Inserate</h1>
      </div>

      <p className="text-sm text-white/40 mb-6 max-w-2xl">
        Eingereicht über{' '}
        <a href="/event-inserieren" className="underline hover:text-white/70">
          /event-inserieren
        </a>
        . Eine Freigabe legt sofort eine öffentliche Veranstaltung an und schickt dem
        Inserenten den Link.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => { setTab(value); setOpenId(null); }}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              tab === value
                ? 'border-amber-400/40 bg-amber-400/[0.08] text-amber-300'
                : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:text-white/80'
            }`}
          >
            {label}
            <span className="ml-2 text-xs text-white/30">{counts[value]}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <p className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {loadError}
        </p>
      )}

      {loading ? (
        <div className="text-center text-white/40 py-16">Lädt …</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm">
            {tab === 'pending' ? 'Keine offenen Inserate.' : 'Nichts in dieser Liste.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => {
            const isOpen = openId === s.id;
            const isBusy = busyId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                {/* Kopfzeile */}
                <button
                  onClick={() => openDetail(s)}
                  aria-expanded={isOpen}
                  className="w-full text-left px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">{s.title}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {formatDateTime(s.start_date, s.is_all_day)}
                        {s.location_name ? ` · ${s.location_name}` : ''}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {s.company ?? s.contact_name} · {s.email}
                      </p>
                    </div>
                    <span className="text-[11px] text-white/25 shrink-0">
                      {new Date(s.created_at).toLocaleDateString('de-AT')}
                    </span>
                  </div>
                </button>

                {/* Detail */}
                {isOpen && (
                  <div className="border-t border-white/[0.06] px-4 py-4 space-y-4">
                    {s.message && (
                      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wider text-white/30 mb-1">
                          Nachricht des Inserenten
                        </p>
                        <p className="text-sm text-white/70 whitespace-pre-wrap">{s.message}</p>
                      </div>
                    )}

                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex gap-2">
                        <dt className="text-white/30 w-24 shrink-0">Ende</dt>
                        <dd className="text-white/60">
                          {s.end_date ? formatDateTime(s.end_date, s.is_all_day) : 'ohne Angabe'}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-white/30 w-24 shrink-0">Typ</dt>
                        <dd className="text-white/60">
                          {s.submitter_type === 'person' ? 'Privatperson' : 'Firma / Verein'}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-white/30 w-24 shrink-0">Telefon</dt>
                        <dd className="text-white/60">{s.phone ?? 'ohne Angabe'}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-white/30 w-24 shrink-0">Website</dt>
                        <dd className="text-white/60 truncate">{s.website ?? 'ohne Angabe'}</dd>
                      </div>
                    </dl>

                    {s.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image_url}
                        alt=""
                        className="max-h-48 rounded-lg border border-white/[0.06] object-cover"
                      />
                    )}

                    {s.status === 'pending' ? (
                      <>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {EDIT_FIELDS.map((field) => (
                            <div
                              key={field.key}
                              className={field.type === 'textarea' ? 'sm:col-span-2' : ''}
                            >
                              <label className="block text-[11px] text-white/30 mb-1">
                                {field.label}
                              </label>
                              {field.type === 'textarea' ? (
                                <textarea
                                  value={edits[field.key] ?? ''}
                                  onChange={(e) =>
                                    setEdits((prev) => ({ ...prev, [field.key]: e.target.value }))
                                  }
                                  rows={4}
                                  className={`${INPUT} resize-y`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={edits[field.key] ?? ''}
                                  onChange={(e) =>
                                    setEdits((prev) => ({ ...prev, [field.key]: e.target.value }))
                                  }
                                  className={INPUT}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/30 mb-1">
                            Anmerkung an den Inserenten (bei Ablehnung Pflicht)
                          </label>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={2}
                            placeholder="z.B. Bild ist nicht frei verwendbar"
                            className={`${INPUT} resize-y`}
                          />
                        </div>

                        {actionError && (
                          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                            {actionError}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => review(s, 'approve')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-400/10 border border-green-400/30 text-green-300 text-sm hover:bg-green-400/15 disabled:opacity-40 transition-colors"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Freigeben & veröffentlichen
                          </button>
                          <button
                            onClick={() => review(s, 'reject')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-400/10 border border-red-400/25 text-red-300 text-sm hover:bg-red-400/15 disabled:opacity-40 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Ablehnen
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <p className="text-white/40">
                          {s.status === 'approved' ? 'Freigegeben' : 'Abgelehnt'}
                          {s.reviewed_at
                            ? ` am ${new Date(s.reviewed_at).toLocaleString('de-AT')}`
                            : ''}
                        </p>
                        {s.review_note && (
                          <p className="text-white/50">Anmerkung: {s.review_note}</p>
                        )}
                        {s.event_id && (
                          <a
                            href={`/admin/events?q=${s.event_id}`}
                            className="inline-flex items-center gap-1.5 text-amber-400/80 hover:text-amber-300"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Event im Admin öffnen
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
