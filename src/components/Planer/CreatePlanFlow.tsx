'use client';

/**
 * Multi-step "Neues Treffen planen" takeover.
 *
 * UX arc:
 *   00 / Anlass        pick mode: privater plan vs öffentliches event
 *   01 / Essenz        fill the minimum viable plan (title, date, location)
 *   02 / Gäste         pick friends to invite
 *   03 / Feinschliff   notes + image + final review
 *
 * The takeover is a full-viewport fixed overlay, not a centered modal —
 * this reframes creation as a "quiet room" instead of a dialog fighting
 * the page underneath.
 *
 * Animation notes:
 *   • Curtain fades in; step content slide-transitions via AnimatePresence
 *   • Direction (+1 forward / -1 back) drives the slide direction so
 *     going back feels genuinely like reversing.
 *   • Progress rail at top pulses the active dot.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LocationAutocomplete } from '@/components/UI/LocationAutocomplete';
import { EventImage } from '@/components/Events/EventImage';
import {
  PlanerButton,
  FormField,
  PlanerInput,
  PlanerTextarea,
  StepRail,
  EditorialHeading,
  EditorialCaption,
  AvatarStack,
} from './primitives';
import {
  curtainEnter,
  stepSlide,
  staggerContainer,
  riseItem,
  springy,
  EASE_OUT_EXPO,
} from './motion';

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

type CreateMode = 'custom' | 'existing';

interface FriendProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface EventResult {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  category: string | null;
}

type PinboardPermission = 'all_members' | 'owner_only' | 'specific_users';

interface DraftState {
  mode: CreateMode | null;
  name: string;
  desc: string;
  date: string;
  time: string;
  locationName: string;
  locationAddress: string;
  locationLat: number | null;
  locationLng: number | null;
  notes: string;
  image: File | null;
  imagePreview: string | null;
  selectedEvent: EventResult | null;
  selectedFriends: string[];
  pinboardPermission: PinboardPermission;
  /** User IDs that may pin when pinboardPermission === 'specific_users' */
  pinboardAllowedUsers: string[];
}

const EMPTY_DRAFT: DraftState = {
  mode: null,
  name: '',
  desc: '',
  date: '',
  time: '',
  locationName: '',
  locationAddress: '',
  locationLat: null,
  locationLng: null,
  notes: '',
  image: null,
  imagePreview: null,
  selectedEvent: null,
  selectedFriends: [],
  pinboardPermission: 'all_members',
  pinboardAllowedUsers: [],
};

interface CreatePlanFlowProps {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  user: User;
  friends: FriendProfile[];
}

// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────

export function CreatePlanFlow({ open, onClose, supabase, user, friends }: CreatePlanFlowProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState<EventResult[]>([]);
  const [friendSearch, setFriendSearch] = useState('');

  // ─── Step definitions ───
  const steps = useMemo(
    () => [
      { label: 'Anlass' },
      { label: 'Essenz' },
      { label: 'Gäste' },
      { label: 'Feinschliff' },
    ],
    [],
  );

  const hasDraft = useCallback(() => {
    return (
      draft.mode !== null ||
      draft.name.trim().length > 0 ||
      draft.desc.trim().length > 0 ||
      draft.date.length > 0 ||
      draft.locationName.trim().length > 0 ||
      draft.notes.trim().length > 0 ||
      draft.image !== null ||
      draft.selectedEvent !== null ||
      draft.selectedFriends.length > 0
    );
  }, [draft]);

  // ─── Body scroll lock + nav hide ───
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('has-modal-open');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('has-modal-open');
      document.body.style.overflow = '';
    };
  }, [open]);

  // ─── Reset when reopened ───
  useEffect(() => {
    if (open) {
      setDraft(EMPTY_DRAFT);
      setStep(0);
      setDirection(1);
      setSubmitError(null);
      setEventSearch('');
      setEventResults([]);
      setFriendSearch('');
    }
  }, [open]);

  // ─── ESC closes (with draft-guard) ───
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  // ─── Event search (for existing-event mode) ───
  useEffect(() => {
    if (!eventSearch.trim()) { setEventResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, location_name, address, latitude, longitude, image_url, category')
        .ilike('title', `%${eventSearch}%`)
        .order('start_date', { ascending: true })
        .limit(8);
      setEventResults(data || []);
    }, 280);
    return () => clearTimeout(timer);
  }, [eventSearch, supabase]);

  // ─── Actions ───
  const requestClose = () => {
    if (!hasDraft()) { onClose(); return; }
    const ok = typeof window !== 'undefined'
      ? window.confirm('Entwurf verwerfen?')
      : true;
    if (ok) onClose();
  };

  const patch = (p: Partial<DraftState>) => setDraft(d => ({ ...d, ...p }));

  const goNext = () => {
    setDirection(1);
    setStep(s => Math.min(steps.length - 1, s + 1));
  };
  const goBack = () => {
    setDirection(-1);
    setStep(s => Math.max(0, s - 1));
  };

  // ─── Step validity ───
  const canContinue = useMemo(() => {
    if (step === 0) return draft.mode !== null;
    if (step === 1) {
      if (draft.mode === 'custom') {
        return draft.name.trim().length > 0 && draft.date.length > 0;
      }
      if (draft.mode === 'existing') return draft.selectedEvent !== null;
    }
    if (step === 2) return true; // Friends optional
    if (step === 3) return true;
    return false;
  }, [step, draft]);

  // ─── Submit ───
  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      let eventDate: string | null = null;
      if (draft.mode === 'existing' && draft.selectedEvent) {
        eventDate = draft.selectedEvent.start_date;
      } else if (draft.date) {
        eventDate = draft.time
          ? new Date(`${draft.date}T${draft.time}`).toISOString()
          : new Date(`${draft.date}T00:00:00`).toISOString();
      }

      let imageUrl: string | null = null;
      if (draft.image) {
        const ext = draft.image.name.split('.').pop() || 'jpg';
        const path = `groups/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('group-images')
          .upload(path, draft.image, { contentType: draft.image.type });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('group-images').getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }
      }

      const insertData = {
        name: draft.mode === 'existing' ? draft.selectedEvent!.title : draft.name.trim(),
        description: draft.desc.trim() || null,
        image_url: imageUrl,
        created_by: user.id,
        invite_code: inviteCode,
        event_type: draft.mode === 'existing' ? 'existing_event' : 'custom',
        linked_event_id: draft.mode === 'existing' ? draft.selectedEvent!.id : null,
        location_name: draft.mode === 'existing' ? draft.selectedEvent!.location_name : (draft.locationName.trim() || null),
        location_address: draft.mode === 'existing' ? draft.selectedEvent!.address : (draft.locationAddress.trim() || null),
        location_lat: draft.mode === 'existing' ? draft.selectedEvent!.latitude : draft.locationLat,
        location_lng: draft.mode === 'existing' ? draft.selectedEvent!.longitude : draft.locationLng,
        event_date: eventDate,
        notes: draft.notes.trim() || null,
        visibility: 'private',
        pinboard_permission: draft.pinboardPermission,
        pinboard_allowed_users:
          draft.pinboardPermission === 'specific_users' ? draft.pinboardAllowedUsers : [],
      };

      const { data: group, error } = await supabase
        .from('groups')
        .insert(insertData)
        .select()
        .single();
      if (error || !group) throw error ?? new Error('insert failed');

      // Owner membership
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner',
        rsvp: 'accepted',
        rsvp_at: new Date().toISOString(),
      });

      if (draft.selectedFriends.length > 0) {
        await supabase.from('group_members').insert(
          draft.selectedFriends.map(fid => ({
            group_id: group.id, user_id: fid, role: 'member', rsvp: 'pending',
          })),
        );
        await supabase.from('notifications').insert(
          draft.selectedFriends.map(fid => ({
            user_id: fid,
            type: 'group_invite' as const,
            title: 'Event-Einladung',
            body: `Du wurdest zu "${insertData.name}" eingeladen`,
            from_user_id: user.id,
            group_id: group.id,
            action_url: `/groups/${group.id}`,
          })),
        );
      }

      await supabase.from('activities').insert({
        user_id: user.id,
        type: 'group_created',
        group_id: group.id,
        metadata: { name: insertData.name, event_type: insertData.event_type },
      });

      // Small celebratory delay before navigating — lets the final UI breathe.
      setTimeout(() => router.push(`/groups/${group.id}`), 350);
    } catch (e: unknown) {
      console.error('Create plan error:', e);
      setSubmitError('Fehler beim Anlegen. Bitte noch einmal versuchen.');
      setSubmitting(false);
    }
  };

  const toggleFriend = (id: string) => {
    patch({
      selectedFriends: draft.selectedFriends.includes(id)
        ? draft.selectedFriends.filter(f => f !== id)
        : [...draft.selectedFriends, id],
    });
  };

  const filteredFriends = friendSearch.trim()
    ? friends.filter(f => {
        const q = friendSearch.toLowerCase();
        return f.first_name.toLowerCase().includes(q) || f.last_name.toLowerCase().includes(q);
      })
    : friends;

  // Render into document.body via portal — escapes the AnimatedLayout's
  // transform-wrapped parent (`position: fixed` would otherwise be
  // relative to the ancestor motion.div, not the viewport, making the
  // overlay render in an unreachable coordinate space).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="create-curtain"
          // Outer stays pure `fixed inset-0` — no `.planer-scope` here.
          // That scope class sets `position: relative`, which (because it
          // lives in unlayered CSS and Tailwind utilities live in @layer
          // utilities) wins the cascade and neuters the `fixed`. Would
          // make the overlay render inline at 0-size: invisible, but body
          // scroll still locked via has-modal-open class → page frozen.
          // Move the scope to an inner wrapper below.
          className="fixed inset-0 z-[100] overflow-y-auto"
          variants={curtainEnter}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
        <div className="planer-scope planer-grain min-h-full w-full" style={{ backgroundColor: 'var(--color-planer-void)' }}>
          {/* Ambient light wash at top */}
          <div
            className="pointer-events-none fixed top-0 left-0 right-0 h-[420px] -z-10"
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(245, 239, 226, 0.08), transparent 70%)',
            }}
          />

          {/* Header — progress rail + close */}
          <header className="sticky top-0 z-20 backdrop-blur-xl bg-[color:var(--color-planer-void)]/70 border-b border-white/[0.05]">
            <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 flex items-center gap-4">
              <div className="flex-1">
                <StepRail
                  steps={steps}
                  current={step}
                  onStepClick={(i) => { setDirection(i < step ? -1 : 1); setStep(i); }}
                />
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Schließen"
                className="shrink-0 w-9 h-9 rounded-full border border-white/[0.08] hover:border-white/20 text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] flex items-center justify-center transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          {/* Step content */}
          <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-32 min-h-[calc(100vh-80px)]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={stepSlide(direction)}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {step === 0 && <StepAnlass draft={draft} onSelect={(m) => { patch({ mode: m }); setDirection(1); setTimeout(() => setStep(1), 260); }} />}
                {step === 1 && (
                  <StepEssenz
                    draft={draft}
                    patch={patch}
                    eventSearch={eventSearch}
                    setEventSearch={setEventSearch}
                    eventResults={eventResults}
                    setEventResults={setEventResults}
                  />
                )}
                {step === 2 && (
                  <StepGäste
                    draft={draft}
                    toggleFriend={toggleFriend}
                    friends={friends}
                    filteredFriends={filteredFriends}
                    friendSearch={friendSearch}
                    setFriendSearch={setFriendSearch}
                  />
                )}
                {step === 3 && <StepFeinschliff draft={draft} patch={patch} friends={friends} />}
              </motion.div>
            </AnimatePresence>

            {submitError && (
              <div className="mt-6 px-4 py-3 rounded-xl bg-[color:var(--color-planer-rose)]/10 border border-[color:var(--color-planer-rose)]/30 text-[color:var(--color-planer-rose)] text-sm">
                {submitError}
              </div>
            )}
          </main>

          {/* Footer — back / next / submit */}
          <footer className="fixed bottom-0 left-0 right-0 z-20 backdrop-blur-xl bg-[color:var(--color-planer-void)]/80 border-t border-white/[0.05]">
            <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-3">
              <div>
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-2 text-sm text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] transition-colors px-2 py-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Zurück</span>
                  </button>
                ) : (
                  <EditorialCaption>
                    <span className="editorial-num mr-2">{String(step + 1).padStart(2, '0')}</span>/ 04
                  </EditorialCaption>
                )}
              </div>

              <div className="flex items-center gap-3">
                {step < steps.length - 1 && (
                  <PlanerButton
                    onClick={goNext}
                    disabled={!canContinue}
                    size="md"
                    variant={step === 0 ? 'ghost' : 'primary'}
                  >
                    {step === 0 ? 'Weiter, wenn du gewählt hast' : 'Weiter'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </PlanerButton>
                )}
                {step === steps.length - 1 && (
                  <PlanerButton
                    onClick={submit}
                    loading={submitting}
                    size="lg"
                    variant="primary"
                  >
                    Plan starten
                  </PlanerButton>
                )}
              </div>
            </div>
          </footer>
        </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ───────────────────────────────────────────────────────────────
// Step 0 — Anlass (mode selection)
// ───────────────────────────────────────────────────────────────

function StepAnlass({
  draft,
  onSelect,
}: {
  draft: DraftState;
  onSelect: (mode: CreateMode) => void;
}) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={riseItem}>
        <EditorialCaption className="mb-4">
          <span className="editorial-num mr-2">00</span>/ Anlass
        </EditorialCaption>
      </motion.div>
      <motion.div variants={riseItem}>
        <EditorialHeading size="hero" className="mb-3">
          Was schwebt euch <em className="italic text-[color:var(--color-planer-accent)]">vor</em>?
        </EditorialHeading>
      </motion.div>
      <motion.p variants={riseItem} className="text-[color:var(--color-planer-dim)] text-[15px] mb-10 max-w-[32rem] leading-relaxed">
        Ein stiller Grillabend im eigenen Garten oder ein Konzert, zu dem ihr gemeinsam geht —
        beide Wege starten hier.
      </motion.p>

      <motion.div variants={riseItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChoiceCard
          active={draft.mode === 'custom'}
          onClick={() => onSelect('custom')}
          number="A"
          title="Privater Plan"
          description="Grillabend, Hausparty, Wanderung, Brettspielabend — ein Treffen, das ihr selbst organisiert."
          hint="Du bestimmst Ort, Zeit und Ton."
          tone="amber"
        />
        <ChoiceCard
          active={draft.mode === 'existing'}
          onClick={() => onSelect('existing')}
          number="B"
          title="Öffentliches Event"
          description="Ihr geht gemeinsam zu einem Konzert, Markt, Festival. Aus der LassTreffen-Datenbank ausgewählt."
          hint="Treffpunkt vor Ort, Zeit steht fest."
          tone="plum"
        />
      </motion.div>
    </motion.div>
  );
}

function ChoiceCard({
  active, onClick, number, title, description, hint, tone,
}: {
  active: boolean; onClick: () => void;
  number: string; title: string; description: string; hint: string;
  tone: 'amber' | 'plum';
}) {
  const toneColor = tone === 'amber'
    ? 'var(--color-planer-accent)'
    : 'var(--color-planer-maybe)';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={springy}
      className={[
        'group relative text-left overflow-hidden rounded-2xl border transition-all duration-500',
        'p-6 sm:p-8 min-h-[220px] flex flex-col',
        active
          ? 'border-[color:var(--color-planer-accent)]/60 bg-[color:var(--color-planer-surface)]'
          : 'border-white/[0.06] bg-[color:var(--color-planer-surface)]/60 hover:border-white/15',
      ].join(' ')}
      style={active ? { boxShadow: `0 14px 40px -28px rgba(245, 239, 226, 0.18)` } : undefined}
    >
      {/* Decorative letter in the corner */}
      <span
        className="absolute top-4 right-6 serif-display text-[76px] leading-none font-light pointer-events-none transition-colors duration-500"
        style={{
          color: active ? toneColor : 'rgba(246, 239, 228, 0.08)',
          opacity: active ? 0.5 : 1,
        }}
      >
        {number}
      </span>

      <div className="flex flex-col gap-3 flex-1">
        <span
          className="text-[10px] uppercase tracking-[0.22em]"
          style={{ color: toneColor }}
        >
          Weg {number}
        </span>
        <h3 className="serif-display text-[24px] sm:text-[28px] font-light text-[color:var(--color-planer-ink)] leading-tight tracking-tight">
          {title}
        </h3>
        <p className="text-sm text-[color:var(--color-planer-dim)] leading-relaxed">
          {description}
        </p>
        <p className="text-xs italic text-[color:var(--color-planer-whisper)] mt-auto pt-4">
          — {hint}
        </p>
      </div>

      {/* Bottom hairline that fills on hover/active */}
      <span
        className={`pointer-events-none absolute bottom-0 left-0 h-[2px] transition-all duration-700`}
        style={{
          width: active ? '100%' : '0%',
          background: toneColor,
        }}
      />
    </motion.button>
  );
}

// ───────────────────────────────────────────────────────────────
// Step 1 — Essenz (fill details)
// ───────────────────────────────────────────────────────────────

function StepEssenz({
  draft, patch, eventSearch, setEventSearch, eventResults, setEventResults,
}: {
  draft: DraftState;
  patch: (p: Partial<DraftState>) => void;
  eventSearch: string; setEventSearch: (s: string) => void;
  eventResults: EventResult[]; setEventResults: (r: EventResult[]) => void;
}) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={riseItem}>
        <EditorialCaption className="mb-4">
          <span className="editorial-num mr-2">01</span>/ Essenz
        </EditorialCaption>
      </motion.div>
      <motion.div variants={riseItem}>
        <EditorialHeading size="hero" className="mb-3">
          {draft.mode === 'custom'
            ? <>Der <em className="italic text-[color:var(--color-planer-accent)]">Kern</em> deines Plans.</>
            : <>Zu welchem <em className="italic text-[color:var(--color-planer-accent)]">Event</em> zieht's euch?</>
          }
        </EditorialHeading>
      </motion.div>
      <motion.p variants={riseItem} className="text-[color:var(--color-planer-dim)] mb-10 max-w-[32rem]">
        {draft.mode === 'custom'
          ? 'Name, Zeit, Ort — mehr braucht\'s jetzt nicht. Der Rest kommt später.'
          : 'Gib einen Teil des Titels ein — wir finden das Event aus unserer Datenbank.'}
      </motion.p>

      {draft.mode === 'custom' && (
        <motion.div variants={riseItem} className="space-y-6 max-w-xl">
          <FormField label="Titel" required>
            <PlanerInput
              type="text"
              autoFocus
              value={draft.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder="Grillabend bei Max"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Datum" required>
              <PlanerInput
                type="date"
                value={draft.date}
                onChange={e => patch({ date: e.target.value })}
              />
            </FormField>
            <FormField label="Uhrzeit">
              <PlanerInput
                type="time"
                value={draft.time}
                onChange={e => patch({ time: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Ort">
            <LocationAutocomplete
              value={draft.locationName}
              onChange={(v) => patch({ locationName: v })}
              onSelect={(loc) => patch({
                locationName: loc.name,
                locationAddress: loc.address,
                locationLat: loc.lat,
                locationLng: loc.lng,
              })}
              label=""
              placeholder="Wien, Altes Brauhaus, Donaukanal …"
            />
          </FormField>

          <AnimatePresence>
            {draft.locationAddress && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                className="overflow-hidden"
              >
                <div className="pl-4 border-l-2 border-[color:var(--color-planer-accent)]/30 space-y-2">
                  <FormField label="Adresse">
                    <PlanerInput
                      type="text"
                      value={draft.locationAddress}
                      onChange={e => patch({ locationAddress: e.target.value })}
                    />
                  </FormField>
                  {draft.locationLat && draft.locationLng && (
                    <p className="text-[11px] italic text-[color:var(--color-planer-accent)]/70 flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ort auf der Karte gefunden
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <FormField label="Kurzbeschreibung" hint="optional">
            <PlanerTextarea
              rows={2}
              value={draft.desc}
              onChange={e => patch({ desc: e.target.value })}
              placeholder="Was ist das — in einem Satz?"
            />
          </FormField>
        </motion.div>
      )}

      {draft.mode === 'existing' && (
        <motion.div variants={riseItem} className="space-y-6 max-w-xl">
          {draft.selectedEvent ? (
            <div className="rounded-2xl border border-[color:var(--color-planer-accent)]/30 bg-[color:var(--color-planer-surface)] p-4 flex items-center gap-4">
              <EventImage
                src={draft.selectedEvent.image_url}
                category={draft.selectedEvent.category}
                title={draft.selectedEvent.title}
                sizes="64px"
                wrapperClassName="w-16 h-16 rounded-xl shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="serif-display text-[18px] font-light text-[color:var(--color-planer-ink)] truncate">
                  {draft.selectedEvent.title}
                </p>
                <p className="text-xs text-[color:var(--color-planer-dim)] mt-1">
                  {formatDate(draft.selectedEvent.start_date)}
                  {draft.selectedEvent.location_name && ` · ${draft.selectedEvent.location_name}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { patch({ selectedEvent: null }); setEventSearch(''); }}
                className="shrink-0 w-8 h-8 rounded-full border border-white/10 text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-rose)] hover:border-[color:var(--color-planer-rose)]/40 flex items-center justify-center transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <FormField label="Event suchen" required>
              <div className="relative">
                <PlanerInput
                  type="text"
                  autoFocus
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Titel, Künstler, Stadt …"
                  iconLeft={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                />
                <AnimatePresence>
                  {eventResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 w-full mt-2 rounded-2xl overflow-hidden bg-[color:var(--color-planer-raised)] border border-white/[0.08] shadow-2xl max-h-80 overflow-y-auto"
                    >
                      {eventResults.map((ev, i) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => { patch({ selectedEvent: ev }); setEventSearch(''); setEventResults([]); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[color:var(--color-planer-accent)]/5 transition-colors border-b border-white/[0.04] last:border-b-0"
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          <EventImage
                            src={ev.image_url}
                            category={ev.category}
                            title={ev.title}
                            sizes="44px"
                            wrapperClassName="w-11 h-11 rounded-lg shrink-0"
                            loading="lazy"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[color:var(--color-planer-ink)] truncate">{ev.title}</p>
                            <p className="text-xs text-[color:var(--color-planer-dim)]">
                              {formatDate(ev.start_date)}
                              {ev.location_name && ` · ${ev.location_name}`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FormField>
          )}

          <FormField label="Treffpunkt" hint="optional, euer Meetingpoint">
            <PlanerTextarea
              rows={2}
              value={draft.desc}
              onChange={e => patch({ desc: e.target.value })}
              placeholder="Wir treffen uns 18:00 am Eingang West …"
            />
          </FormField>
        </motion.div>
      )}
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────
// Step 2 — Gäste
// ───────────────────────────────────────────────────────────────

function StepGäste({
  draft, toggleFriend, friends, filteredFriends, friendSearch, setFriendSearch,
}: {
  draft: DraftState;
  toggleFriend: (id: string) => void;
  friends: FriendProfile[];
  filteredFriends: FriendProfile[];
  friendSearch: string;
  setFriendSearch: (s: string) => void;
}) {
  const selectedCount = draft.selectedFriends.length;
  const selectedAvatars = friends
    .filter(f => draft.selectedFriends.includes(f.id))
    .map(f => ({ url: f.avatar_url, name: f.first_name }));

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={riseItem}>
        <EditorialCaption className="mb-4">
          <span className="editorial-num mr-2">02</span>/ Gäste
        </EditorialCaption>
      </motion.div>
      <motion.div variants={riseItem}>
        <EditorialHeading size="hero" className="mb-3">
          Wer kommt <em className="italic text-[color:var(--color-planer-accent)]">mit</em>?
        </EditorialHeading>
      </motion.div>
      <motion.p variants={riseItem} className="text-[color:var(--color-planer-dim)] mb-6 max-w-[32rem]">
        {friends.length === 0
          ? 'Du hast noch keine Freunde hinzugefügt — das geht auch später über den Einladungslink.'
          : 'Wähle aus. Einladungs-Benachrichtigungen gehen automatisch raus.'}
      </motion.p>

      {friends.length > 0 && (
        <motion.div variants={riseItem}>
          {/* Selection status bar */}
          <AnimatePresence>
            {selectedCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 flex items-center gap-4 p-4 rounded-2xl border border-[color:var(--color-planer-accent)]/20 bg-[color:var(--color-planer-accent)]/[0.04]"
              >
                <AvatarStack avatars={selectedAvatars} size={34} max={6} />
                <div className="flex-1">
                  <p className="serif-display text-[20px] font-light text-[color:var(--color-planer-ink)]">
                    <span className="tabular text-[color:var(--color-planer-accent)]">{selectedCount}</span> eingeladen
                  </p>
                  <p className="text-xs text-[color:var(--color-planer-dim)] italic">
                    {selectedCount === 1 ? 'Es könnte der Beginn von etwas Schönem sein.' : 'Genug für einen richtig guten Abend.'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {friends.length > 6 && (
            <div className="mb-4">
              <PlanerInput
                type="text"
                placeholder="Freund:innen suchen …"
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                iconLeft={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
          )}

          <motion.ul variants={staggerContainer} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {filteredFriends.map((f, i) => {
              const selected = draft.selectedFriends.includes(f.id);
              return (
                <motion.li key={f.id} variants={riseItem} custom={i}>
                  <button
                    type="button"
                    onClick={() => toggleFriend(f.id)}
                    className={[
                      'w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300',
                      selected
                        ? 'border-[color:var(--color-planer-accent)]/60 bg-[color:var(--color-planer-accent)]/[0.06]'
                        : 'border-white/[0.06] bg-[color:var(--color-planer-surface)]/50 hover:border-white/15',
                    ].join(' ')}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-sm font-medium text-white/60">
                        {f.avatar_url
                          ? // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                          : f.first_name[0]?.toUpperCase() || '?'
                        }
                      </div>
                      {selected && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={springy}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[color:var(--color-planer-accent)] flex items-center justify-center text-[color:var(--color-planer-void)]"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.span>
                      )}
                    </div>
                    <span className="text-sm text-[color:var(--color-planer-ink)] truncate text-left">
                      {f.first_name}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        </motion.div>
      )}
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────
// Step 3 — Feinschliff (review + optional image, notes)
// ───────────────────────────────────────────────────────────────

function StepFeinschliff({
  draft, patch, friends,
}: {
  draft: DraftState;
  patch: (p: Partial<DraftState>) => void;
  friends: FriendProfile[];
}) {
  // Only friends the user actually invited are eligible to be pin-authorized.
  // Someone you haven't included on the guest list shouldn't be in this picker.
  const invitedFriends = friends.filter(f => draft.selectedFriends.includes(f.id));
  const togglePinUser = (id: string) => {
    const current = draft.pinboardAllowedUsers;
    patch({
      pinboardAllowedUsers: current.includes(id)
        ? current.filter(u => u !== id)
        : [...current, id],
    });
  };
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-AT', { day: 'numeric', month: 'long' });
  };

  const previewDate = draft.selectedEvent
    ? formatDate(draft.selectedEvent.start_date)
    : draft.date
    ? formatDate(`${draft.date}T${draft.time || '00:00'}`)
    : '—';
  const previewLocation = draft.selectedEvent?.location_name || draft.locationName || '—';
  const previewName = draft.selectedEvent?.title || draft.name || '—';

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={riseItem}>
        <EditorialCaption className="mb-4">
          <span className="editorial-num mr-2">03</span>/ Feinschliff
        </EditorialCaption>
      </motion.div>
      <motion.div variants={riseItem}>
        <EditorialHeading size="hero" className="mb-3">
          Fast <em className="italic text-[color:var(--color-planer-accent)]">fertig</em>.
        </EditorialHeading>
      </motion.div>
      <motion.p variants={riseItem} className="text-[color:var(--color-planer-dim)] mb-10 max-w-[32rem]">
        Ein Bild, ein paar Notizen zum Anfahrts-Weg — alles optional, alles später editierbar.
      </motion.p>

      {/* Preview card */}
      <motion.div variants={riseItem} className="mb-10">
        <div className="rounded-3xl border border-[color:var(--color-planer-accent)]/15 overflow-hidden bg-gradient-to-br from-[color:var(--color-planer-surface)] to-[color:var(--color-planer-raised)]">
          <div className="p-6 sm:p-8">
            <EditorialCaption className="mb-3">Vorschau</EditorialCaption>
            <h3 className="serif-display text-[28px] sm:text-[34px] font-light leading-tight text-[color:var(--color-planer-ink)]">
              {previewName}
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2 text-[color:var(--color-planer-dim)]">
                <svg className="w-3.5 h-3.5 text-[color:var(--color-planer-accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm0 6h10v8H7v-8z" />
                </svg>
                {previewDate}
              </span>
              <span className="flex items-center gap-2 text-[color:var(--color-planer-dim)]">
                <svg className="w-3.5 h-3.5 text-[color:var(--color-planer-accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a8 8 0 00-8 8c0 5.4 7 11.5 7.3 11.8.4.3.9.3 1.3 0C13 21.5 20 15.4 20 10a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
                {previewLocation}
              </span>
              <span className="flex items-center gap-2 text-[color:var(--color-planer-dim)]">
                <svg className="w-3.5 h-3.5 text-[color:var(--color-planer-accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                {draft.selectedFriends.length} {draft.selectedFriends.length === 1 ? 'Freund:in' : 'Freund:innen'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={riseItem} className="space-y-6 max-w-xl">
        {/* Image upload */}
        <FormField label="Titelbild" hint="optional">
          {draft.imagePreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.imagePreview} alt="" className="w-full h-40 object-cover" />
              <button
                type="button"
                onClick={() => {
                  if (draft.imagePreview) URL.revokeObjectURL(draft.imagePreview);
                  patch({ image: null, imagePreview: null });
                }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[color:var(--color-planer-void)]/80 backdrop-blur-md flex items-center justify-center text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-rose)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-[color:var(--color-planer-accent)]/40 bg-white/[0.02] cursor-pointer transition-all text-[color:var(--color-planer-whisper)] hover:text-[color:var(--color-planer-accent)]/80">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Bild auswählen</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) patch({ image: file, imagePreview: URL.createObjectURL(file) });
                }}
              />
            </label>
          )}
        </FormField>

        <FormField label="Erste Notiz" hint="landet als Post-it auf der Pinnwand">
          <PlanerTextarea
            rows={3}
            value={draft.notes}
            onChange={e => patch({ notes: e.target.value })}
            placeholder="Parken hinter dem Haus. Wer kann Kohle besorgen?"
          />
        </FormField>

        {/* Pinboard permission — segmented control, three modes */}
        <FormField label="Pinnwand-Rechte" hint="wer darf Notizen anpinnen?">
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {([
              { key: 'all_members', label: 'Alle Eingeladenen', sub: 'jeder' },
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
                    'px-3 py-2.5 rounded-lg text-left transition-all',
                    active
                      ? 'bg-[color:var(--color-planer-accent)]/12 ring-1 ring-[color:var(--color-planer-accent)]/40'
                      : 'hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  <div className={`text-[12px] font-medium leading-tight ${active ? 'text-[color:var(--color-planer-ink)]' : 'text-[color:var(--color-planer-dim)]'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[9px] text-[color:var(--color-planer-whisper)] mt-0.5">
                    {opt.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </FormField>

        {/* Friend-picker — only when 'specific_users' is selected */}
        <AnimatePresence>
          {draft.pinboardPermission === 'specific_users' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
              className="overflow-hidden"
            >
              <FormField label="Wer darf pinnen" hint="tap zum aus-/abwählen — nur aus den Eingeladenen">
                {invitedFriends.length === 0 ? (
                  <p className="text-xs italic text-[color:var(--color-planer-whisper)]">
                    Du hast in Schritt 2 noch niemanden eingeladen. Geh zurück und wähle ein paar aus.
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
                Du als Ersteller darfst sowieso immer pinnen.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
