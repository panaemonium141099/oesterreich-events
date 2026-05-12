'use client';

/**
 * Owner-only drawer for editing or deleting a plan.
 *
 * Opens from the right edge of the viewport via a motion-lib slide.
 * Rendered through a portal to document.body so it escapes any ancestor
 * with a transform (same reason CreatePlanFlow uses a portal).
 *
 * Editable fields mirror the Create-Flow but act as an UPDATE, not an
 * INSERT:
 *   name, description, date, time, location (+ lat/lng), notes,
 *   pinboard_permission, pinboard_allowed_users
 *
 * Delete section at the bottom cascades child rows explicitly because
 * we don't know which FKs have ON DELETE CASCADE — safer to do it in
 * app code than rely on schema assumptions.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { LocationAutocomplete } from '@/components/UI/LocationAutocomplete';
import {
  PlanerButton,
  FormField,
  PlanerInput,
  PlanerTextarea,
  EditorialCaption,
  EditorialHeading,
} from '../primitives';

// fn-15.5: motion-lib AnimatePresence + spring slide replaced by
// CSS `data-drawer-state` + `data-overlay-state` swap (globals.css).
const EXIT_MS = 320;

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

type PinboardPermission = 'all_members' | 'owner_only' | 'specific_users';

export interface PlanForSettings {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  image_url: string | null;
  notes: string | null;
  pinboard_permission: PinboardPermission;
  pinboard_allowed_users: string[] | null;
}

export interface FriendProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface MemberMini {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plan: PlanForSettings;
  supabase: SupabaseClient;
  user: User;
  /** Is the viewing user the original creator? Co-owners (admin role) can edit
   *  but only the creator can delete the plan and manage roles. */
  isOwner: boolean;
  /** All members of this plan — needed for the role-management section */
  members: MemberMini[];
  /** Friends invited to this plan — the pool for specific_users permission */
  invitedFriends: FriendProfile[];
  /** Promote a plain member to co-organizer (admin role). Owner-only. */
  onPromote: (memberId: string, memberUserId: string, firstName: string) => void;
  /** Demote a co-organizer back to regular member. Owner-only. */
  onDemote: (memberId: string, firstName: string) => void;
  /** Fired after a successful save so the parent can re-fetch */
  onSaved: () => void;
}

interface Draft {
  name: string;
  description: string;
  date: string;       // yyyy-mm-dd
  time: string;       // HH:mm
  locationName: string;
  locationAddress: string;
  locationLat: number | null;
  locationLng: number | null;
  notes: string;
  newImage: File | null;
  imagePreview: string | null;
  removeImage: boolean;     // true if owner clicked "remove existing"
  pinboardPermission: PinboardPermission;
  pinboardAllowedUsers: string[];
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function splitDate(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  // If time is exactly 00:00 we treat it as "no time set" so the input is empty
  const timeBlank = hh === '00' && mm === '00';
  return { date: `${y}-${m}-${day}`, time: timeBlank ? '' : `${hh}:${mm}` };
}

function buildDraft(plan: PlanForSettings): Draft {
  const { date, time } = splitDate(plan.event_date);
  return {
    name: plan.name,
    description: plan.description ?? '',
    date,
    time,
    locationName: plan.location_name ?? '',
    locationAddress: plan.location_address ?? '',
    locationLat: plan.location_lat,
    locationLng: plan.location_lng,
    notes: plan.notes ?? '',
    newImage: null,
    imagePreview: null,
    removeImage: false,
    pinboardPermission: plan.pinboard_permission,
    pinboardAllowedUsers: plan.pinboard_allowed_users ?? [],
  };
}

// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────

export function PlanSettingsDrawer({
  open, onClose, plan, supabase, user,
  isOwner, members, invitedFriends,
  onPromote, onDemote, onSaved,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => buildDraft(plan));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  // fn-15.5: keep the drawer mounted long enough for its CSS slide-out
  // keyframe to play before unmount, mirroring AnimatePresence.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // Reset the draft whenever we reopen, or when the backing plan object changes
  useEffect(() => {
    if (open) setDraft(buildDraft(plan));
  }, [open, plan]);

  // Body scroll lock + ESC to close (unless a sub-dialog is open)
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('has-modal-open');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDelete) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.classList.remove('has-modal-open');
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose, confirmDelete]);

  // Clean up object-URL on unmount / preview-swap
  useEffect(() => {
    return () => { if (draft.imagePreview) URL.revokeObjectURL(draft.imagePreview); };
  }, [draft.imagePreview]);

  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));

  // ─── Save ───
  const handleSave = useCallback(async () => {
    if (!draft.name.trim()) { toast.error('Name darf nicht leer sein'); return; }
    setSaving(true);

    // Compose event_date. If the user cleared both date and time, we set null.
    let eventDate: string | null = null;
    if (draft.date) {
      eventDate = draft.time
        ? new Date(`${draft.date}T${draft.time}`).toISOString()
        : new Date(`${draft.date}T00:00:00`).toISOString();
    }

    // Upload new image if picked
    let newImageUrl: string | null | undefined;  // undefined = don't touch
    if (draft.newImage) {
      const ext = draft.newImage.name.split('.').pop() || 'jpg';
      const path = `groups/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('group-images')
        .upload(path, draft.newImage, { contentType: draft.newImage.type });
      if (upErr) { toast.error('Bild-Upload fehlgeschlagen'); setSaving(false); return; }
      const { data: url } = supabase.storage.from('group-images').getPublicUrl(path);
      newImageUrl = url.publicUrl;
    } else if (draft.removeImage) {
      newImageUrl = null;
    }

    const patchData: Record<string, unknown> = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      event_date: eventDate,
      location_name: draft.locationName.trim() || null,
      location_address: draft.locationAddress.trim() || null,
      location_lat: draft.locationLat,
      location_lng: draft.locationLng,
      notes: draft.notes.trim() || null,
      pinboard_permission: draft.pinboardPermission,
      pinboard_allowed_users:
        draft.pinboardPermission === 'specific_users' ? draft.pinboardAllowedUsers : [],
    };
    if (newImageUrl !== undefined) patchData.image_url = newImageUrl;

    const { error } = await supabase
      .from('groups')
      .update(patchData)
      .eq('id', plan.id)
      .eq('created_by', user.id); // paranoia — RLS should enforce this already

    if (error) {
      console.error('[plan-settings] save failed:', error);
      toast.error(`Fehler: ${error.message}`);
      setSaving(false);
      return;
    }
    toast.success('Plan aktualisiert');
    onSaved();
    setSaving(false);
    onClose();
  }, [draft, supabase, user, plan.id, onSaved, onClose]);

  // ─── Delete ───
  // The FK schema may or may not have ON DELETE CASCADE on every child
  // table (group_members has it, others uncertain), so clean up
  // explicitly before dropping the group row.
  const handleDelete = useCallback(async () => {
    if (deleteConfirmText.trim().toLowerCase() !== plan.name.trim().toLowerCase()) {
      toast.error('Name stimmt nicht überein');
      return;
    }
    setDeleting(true);
    try {
      // 1. Drop photos linked to memories of this plan (no direct FK to group)
      const { data: mems } = await supabase
        .from('memories')
        .select('id')
        .eq('group_id', plan.id);
      if (mems && mems.length > 0) {
        const memIds = mems.map((m: { id: string }) => m.id);
        await supabase.from('memory_photos').delete().in('memory_id', memIds);
      }
      // 2. Cascade children in parallel
      await Promise.all([
        supabase.from('memories').delete().eq('group_id', plan.id),
        supabase.from('group_pinboard_notes').delete().eq('group_id', plan.id),
        supabase.from('group_contributions').delete().eq('group_id', plan.id),
        supabase.from('group_messages').delete().eq('group_id', plan.id),
        supabase.from('activities').delete().eq('group_id', plan.id),
        supabase.from('notifications').delete().eq('group_id', plan.id),
        supabase.from('group_members').delete().eq('group_id', plan.id),
      ]);
      // 3. Finally delete the group itself
      const { error } = await supabase.from('groups').delete().eq('id', plan.id);
      if (error) throw error;
      toast.success('Plan gelöscht');
      router.replace('/groups');
    } catch (e) {
      console.error('[plan-settings] delete failed:', e);
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
      setDeleting(false);
    }
  }, [deleteConfirmText, plan.id, plan.name, supabase, router]);

  const togglePinUser = (id: string) => {
    patch({
      pinboardAllowedUsers: draft.pinboardAllowedUsers.includes(id)
        ? draft.pinboardAllowedUsers.filter(u => u !== id)
        : [...draft.pinboardAllowedUsers, id],
    });
  };

  if (typeof document === 'undefined') return null;
  if (!mounted) return null;

  const state = open ? 'open' : 'closed';

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        data-overlay-state={state}
      />
      {/* Drawer panel — slides in from the right */}
      <aside
        className="fixed inset-y-0 right-0 z-[100] w-full sm:w-[460px] overflow-y-auto"
        data-drawer-state={state}
      >
            <div className="planer-scope min-h-full" style={{ backgroundColor: 'var(--color-planer-surface)' }}>
              {/* Header */}
              <header className="sticky top-0 z-10 backdrop-blur-xl bg-[color:var(--color-planer-surface)]/90 border-b border-white/[0.05] px-6 py-5 flex items-start justify-between gap-3">
                <div>
                  <EditorialCaption className="mb-1.5">Einstellungen</EditorialCaption>
                  <EditorialHeading size="inline">
                    Plan bearbeiten
                  </EditorialHeading>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Schließen"
                  className="shrink-0 w-9 h-9 rounded-full border border-white/[0.08] hover:border-white/20 text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] flex items-center justify-center transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>

              {/* Body */}
              <div className="px-6 py-6 space-y-6">
                <FormField label="Titel" required>
                  <PlanerInput
                    type="text"
                    value={draft.name}
                    onChange={e => patch({ name: e.target.value })}
                  />
                </FormField>

                <FormField label="Beschreibung" hint="optional">
                  <PlanerTextarea
                    rows={2}
                    value={draft.description}
                    onChange={e => patch({ description: e.target.value })}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Datum">
                    <PlanerInput type="date" value={draft.date} onChange={e => patch({ date: e.target.value })} />
                  </FormField>
                  <FormField label="Uhrzeit">
                    <PlanerInput type="time" value={draft.time} onChange={e => patch({ time: e.target.value })} />
                  </FormField>
                </div>

                <FormField label="Ort">
                  <LocationAutocomplete
                    value={draft.locationName}
                    onChange={v => patch({ locationName: v })}
                    onSelect={loc => patch({
                      locationName: loc.name,
                      locationAddress: loc.address,
                      locationLat: loc.lat,
                      locationLng: loc.lng,
                    })}
                    label=""
                    placeholder="Ort suchen …"
                  />
                </FormField>

                {draft.locationAddress && (
                  <FormField label="Adresse">
                    <PlanerInput
                      type="text"
                      value={draft.locationAddress}
                      onChange={e => patch({ locationAddress: e.target.value })}
                    />
                  </FormField>
                )}

                {/* Cover image — replace or remove */}
                <FormField label="Titelbild" hint="optional">
                  {draft.imagePreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.imagePreview} alt="" className="w-full h-32 object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          if (draft.imagePreview) URL.revokeObjectURL(draft.imagePreview);
                          patch({ newImage: null, imagePreview: null });
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[color:var(--color-planer-void)]/80 flex items-center justify-center text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-rose)]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : plan.image_url && !draft.removeImage ? (
                    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={plan.image_url} alt="" className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2">
                        <label className="px-3 py-1.5 rounded-full bg-[color:var(--color-planer-void)]/90 text-xs text-[color:var(--color-planer-ink)] cursor-pointer hover:bg-[color:var(--color-planer-void)]">
                          Ersetzen
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) patch({ newImage: f, imagePreview: URL.createObjectURL(f), removeImage: false });
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => patch({ removeImage: true })}
                          className="px-3 py-1.5 rounded-full bg-[color:var(--color-planer-rose)]/80 text-xs text-white hover:bg-[color:var(--color-planer-rose)]"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-[color:var(--color-planer-accent)]/40 bg-white/[0.02] cursor-pointer transition-all text-[color:var(--color-planer-whisper)] hover:text-[color:var(--color-planer-accent)]/80">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">
                        {draft.removeImage ? 'Bild wird beim Speichern entfernt · neues wählen' : 'Bild auswählen'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) patch({ newImage: f, imagePreview: URL.createObjectURL(f), removeImage: false });
                        }}
                      />
                    </label>
                  )}
                </FormField>

                <FormField label="Notizen" hint="Anfahrt, mitbringen …">
                  <PlanerTextarea
                    rows={3}
                    value={draft.notes}
                    onChange={e => patch({ notes: e.target.value })}
                  />
                </FormField>

                {/* Pinboard permission — 3-way segmented */}
                <FormField label="Pinnwand-Rechte" hint="wer darf anpinnen?">
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {([
                      { key: 'all_members', label: 'Alle', sub: 'jeder' },
                      { key: 'specific_users', label: 'Bestimmte', sub: 'du wählst' },
                      { key: 'owner_only', label: 'Nur ich', sub: 'rest liest' },
                    ] as const).map(opt => {
                      const active = draft.pinboardPermission === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => patch({ pinboardPermission: opt.key })}
                          className={[
                            'px-2.5 py-2 rounded-lg text-left transition-all',
                            active
                              ? 'bg-[color:var(--color-planer-accent)]/12 ring-1 ring-[color:var(--color-planer-accent)]/40'
                              : 'hover:bg-white/[0.03]',
                          ].join(' ')}
                        >
                          <div className={`text-[11px] font-medium leading-tight ${active ? 'text-[color:var(--color-planer-ink)]' : 'text-[color:var(--color-planer-dim)]'}`}>
                            {opt.label}
                          </div>
                          <div className="text-[9px] text-[color:var(--color-planer-whisper)] mt-0.5">{opt.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </FormField>

                {/* Friend picker for specific_users */}
                {draft.pinboardPermission === 'specific_users' && (
                  <div className="overflow-hidden animate-fade-in motion-reduce:animate-none">
                      <FormField label="Wer darf pinnen" hint="tap zum aus-/abwählen">
                        {invitedFriends.length === 0 ? (
                          <p className="text-xs italic text-[color:var(--color-planer-whisper)]">
                            Keine eingeladenen Freunde — lade erst welche über den Code ein.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {invitedFriends.map(f => {
                              const selected = draft.pinboardAllowedUsers.includes(f.id);
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => togglePinUser(f.id)}
                                  className={[
                                    'inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border transition-all',
                                    selected
                                      ? 'border-[color:var(--color-planer-accent)]/60 bg-[color:var(--color-planer-accent)]/[0.08]'
                                      : 'border-white/[0.08] hover:border-white/20',
                                  ].join(' ')}
                                >
                                  <span className="w-6 h-6 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[10px] text-white/60">
                                    {f.avatar_url
                                      // eslint-disable-next-line @next/next/no-img-element
                                      ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                                      : f.first_name[0]?.toUpperCase() || '?'}
                                  </span>
                                  <span className={`text-xs ${selected ? 'text-[color:var(--color-planer-ink)]' : 'text-[color:var(--color-planer-dim)]'}`}>
                                    {f.first_name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </FormField>
                      <p className="text-[10px] text-[color:var(--color-planer-whisper)] italic mt-2">
                        Du als Ersteller darfst sowieso immer.
                      </p>
                  </div>
                )}

                {/* Save actions */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/[0.05]">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="text-sm text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] px-3 py-2"
                  >
                    Abbrechen
                  </button>
                  <PlanerButton
                    onClick={handleSave}
                    loading={saving}
                    variant="primary"
                    size="md"
                    disabled={!draft.name.trim()}
                  >
                    Speichern
                  </PlanerButton>
                </div>

                {/* Role management — owner only */}
                {isOwner && members.filter(m => m.user_id !== user.id && m.profile).length > 0 && (
                  <section className="mt-10 pt-6 border-t border-white/[0.05]">
                    <EditorialCaption className="mb-2">Co-Organisator*innen</EditorialCaption>
                    <p className="text-xs text-[color:var(--color-planer-dim)] mb-4 leading-relaxed">
                      Co-Organisator*innen können den Plan bearbeiten und einladen — löschen kannst nur du.
                    </p>
                    <ul className="space-y-1.5">
                      {members.filter(m => m.user_id !== user.id && m.profile).map(m => {
                        const isAdmin = m.role === 'admin';
                        const name = `${m.profile!.first_name} ${m.profile!.last_name}`.trim();
                        return (
                          <li key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.025] transition-colors">
                            {m.profile?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm text-white/60">
                                {m.profile!.first_name[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-[color:var(--color-planer-ink)] truncate">{name}</div>
                              {isAdmin && (
                                <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-planer-accent)]">
                                  Co-Organisator*in
                                </div>
                              )}
                            </div>
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => onDemote(m.id, m.profile!.first_name)}
                                className="text-xs text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-rose)] px-2 py-1 transition-colors"
                              >
                                Zurückstufen
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onPromote(m.id, m.user_id, m.profile!.first_name)}
                                className="text-xs text-[color:var(--color-planer-accent)] hover:opacity-80 px-2 py-1 transition-opacity"
                              >
                                Hochstufen
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* Danger zone — only the original creator can delete the plan */}
                {isOwner && (
                  <section className="mt-10 pt-6 border-t border-[color:var(--color-planer-rose)]/20">
                    <EditorialCaption className="mb-2 text-[color:var(--color-planer-rose)]/80">
                      Danger Zone
                    </EditorialCaption>
                    <p className="text-xs text-[color:var(--color-planer-dim)] mb-4 leading-relaxed">
                      Löscht diesen Plan unwiderruflich, inklusive Chat-Verlauf, Post-its,
                      Mitbringsel-Liste, Erinnerungen und allen Aktivitäten. Teilnehmer werden
                      nicht benachrichtigt — mach das nur wenn du sicher bist.
                    </p>
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="px-4 py-2.5 rounded-xl border border-[color:var(--color-planer-rose)]/30 text-[color:var(--color-planer-rose)] text-sm hover:bg-[color:var(--color-planer-rose)]/10 hover:border-[color:var(--color-planer-rose)]/60 transition-all"
                      >
                        Plan löschen
                      </button>
                    ) : (
                      <div className="space-y-3 p-4 rounded-xl border border-[color:var(--color-planer-rose)]/40 bg-[color:var(--color-planer-rose)]/5">
                        <p className="text-xs text-[color:var(--color-planer-ink)]">
                          Tippe den Plan-Namen <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{plan.name}</span> um das Löschen zu bestätigen:
                        </p>
                        <PlanerInput
                          type="text"
                          value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder={plan.name}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }}
                            disabled={deleting}
                            className="text-xs text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] px-3 py-2"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting || deleteConfirmText.trim().toLowerCase() !== plan.name.trim().toLowerCase()}
                            className="px-4 py-2 rounded-full bg-[color:var(--color-planer-rose)] text-white text-xs font-semibold hover:bg-[color:var(--color-planer-rose)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            {deleting ? 'Lösche …' : 'Unwiderruflich löschen'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Co-owner hint — they can edit but not delete */}
                {!isOwner && (
                  <section className="mt-10 pt-6 border-t border-white/[0.05]">
                    <p className="text-xs italic text-[color:var(--color-planer-dim)]">
                      Du bist Co-Organisator*in. Nur der/die Ersteller*in kann den Plan löschen.
                    </p>
                  </section>
                )}
              </div>
            </div>
          </aside>
    </>,
    document.body,
  );
}
