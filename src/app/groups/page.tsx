'use client';

/**
 * "Planer" hub — entry point for planning group events.
 *
 * Full UI rework (cat "cinematic editorial"):
 *  - Serif display typography (Fraunces) for hero & plan names
 *  - Geist body for running text
 *  - Amber warm accent, single color family
 *  - Grain + radial spotlight atmosphere via .planer-scope
 *  - Asymmetric plan-card grid with featured "next-up" treatment
 *  - Delightful empty state with editorial quote
 *  - Create flow is a full-viewport takeover (see CreatePlanFlow.tsx),
 *    not a centered modal — feels like a "quiet room" instead of a dialog.
 *
 * The Supabase data logic is unchanged from the previous implementation;
 * only the presentation layer is redesigned. See CHANGELOG.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { ProfileDropdown } from '@/components/Layout/ProfileDropdown';
import {
  PlanerShell,
  EditorialHeading,
  EditorialCaption,
  PlanerButton,
} from '@/components/Planer/primitives';
import { PlanCard, type PlanCardData } from '@/components/Planer/PlanCard';
import { CreatePlanFlow } from '@/components/Planer/CreatePlanFlow';
import { staggerContainer, riseItem } from '@/components/Planer/motion';

interface PlannedEvent extends PlanCardData {
  // extra fields only used on this page (none right now)
}

interface FriendProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export default function EventPlanenPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [events, setEvents] = useState<PlannedEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);

  // ─── Auth gate ───
  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [loading, user, router]);

  // ─── Fetch events + members ───
  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoadingEvents(true);
    try {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, rsvp')
        .eq('user_id', user.id);
      if (!memberships || memberships.length === 0) {
        setEvents([]);
        setLoadingEvents(false);
        return;
      }
      const groupIds = memberships.map((m: { group_id: string }) => m.group_id);
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('event_date', { ascending: true, nullsFirst: false });
      if (!groupsData) {
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      const enriched = await Promise.all(
        groupsData.map(async (g: { id: string; name: string; event_type: string; event_date: string | null; location_name: string | null; location_lat: number | null; location_lng: number | null; image_url: string | null; linked_event_id: string | null }) => {
          const [{ data: members }, { data: lastMsg }] = await Promise.all([
            supabase
              .from('group_members')
              .select('rsvp, user_id, profiles!group_members_user_id_fkey(id, first_name, avatar_url)')
              .eq('group_id', g.id)
              .limit(12),
            supabase
              .from('group_messages')
              .select('content, created_at')
              .eq('group_id', g.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          const rsvp_counts = { accepted: 0, maybe: 0, pending: 0, declined: 0 };
          const avatars: { url: string | null; name: string }[] = [];
          (members || []).forEach((m: { rsvp: string; profiles?: { first_name: string; avatar_url: string | null } | { first_name: string; avatar_url: string | null }[] }) => {
            if (m.rsvp === 'accepted') rsvp_counts.accepted++;
            else if (m.rsvp === 'maybe') rsvp_counts.maybe++;
            else if (m.rsvp === 'declined') rsvp_counts.declined++;
            else rsvp_counts.pending++;
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            if (profile) avatars.push({ url: profile.avatar_url, name: profile.first_name });
          });

          let linked_event_image_url: string | null = null;
          if (g.linked_event_id) {
            const { data: evt } = await supabase
              .from('events')
              .select('image_url')
              .eq('id', g.linked_event_id)
              .single();
            linked_event_image_url = evt?.image_url ?? null;
          }

          return {
            id: g.id,
            name: g.name,
            event_type: g.event_type,
            event_date: g.event_date,
            location_name: g.location_name,
            location_lat: g.location_lat,
            location_lng: g.location_lng,
            image_url: g.image_url,
            linked_event_image_url,
            member_count: (members || []).length,
            rsvp_counts,
            last_message: lastMsg?.content || null,
            last_message_at: lastMsg?.created_at || null,
            participant_avatars: avatars.slice(0, 6),
          } satisfies PlannedEvent;
        }),
      );

      setEvents(enriched);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [user, supabase]);

  useEffect(() => { if (user) fetchEvents(); }, [user, fetchEvents]);

  // ─── Load friends for invite step ───
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: accepted } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, first_name, last_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, first_name, last_name, avatar_url)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      if (!accepted) return;
      const list: FriendProfile[] = accepted.map((f: { requester: FriendProfile | FriendProfile[]; addressee: FriendProfile | FriendProfile[] }) => {
        const req = Array.isArray(f.requester) ? f.requester[0] : f.requester;
        const addr = Array.isArray(f.addressee) ? f.addressee[0] : f.addressee;
        return req?.id === user.id ? addr : req;
      });
      setFriends(list);
    })();
  }, [user, supabase]);

  // ─── Partition: upcoming vs past ───
  const now = new Date();
  const upcoming: PlannedEvent[] = [];
  const past: PlannedEvent[] = [];
  events.forEach(ev => {
    if (ev.event_date && new Date(ev.event_date) < now) past.push(ev);
    else upcoming.push(ev);
  });
  // First upcoming = "next" — gets a subtle accent ring + "↓ ALS NÄCHSTES"
  // caption above it. All cards otherwise share the same layout so the rhythm
  // stays consistent (no feature-vs-runner-up mismatch).
  const totalPeople = events.reduce((n, e) => n + e.rsvp_counts.accepted, 0);

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <PlanerShell>
        <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-32">
          <div className="h-4 w-24 rounded bg-white/[0.04] mb-4 animate-pulse" />
          <div className="h-10 w-80 max-w-full rounded bg-white/[0.04] mb-8 animate-pulse" />
          <div className="h-56 rounded-[22px] bg-white/[0.03] animate-pulse" />
        </main>
      </PlanerShell>
    );
  }

  if (!user) return null;

  return (
    <PlanerShell>
      {/* Background faint editorial rule at top */}
      <div className="pointer-events-none absolute top-24 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-planer-accent)]/20 to-transparent z-0" />

      <main className="relative max-w-5xl mx-auto px-5 sm:px-8 pt-8 sm:pt-12 pb-32">
        {/* Top row — profile */}
        <div className="flex justify-end mb-6 sm:mb-8">
          <ProfileDropdown />
        </div>

        {/* HERO */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mb-12 sm:mb-16"
        >
          <motion.div variants={riseItem} className="mb-5">
            <EditorialCaption>
              <span className="editorial-num mr-2">{String(events.length).padStart(2, '0')}</span>
              / {events.length === 1 ? 'aktives Treffen' : 'aktive Treffen'}
              {totalPeople > 0 && (
                <>
                  <span className="mx-3 text-[color:var(--color-planer-whisper)]">—</span>
                  <span className="tabular">{totalPeople}</span> {totalPeople === 1 ? 'Zusage' : 'Zusagen'}
                </>
              )}
            </EditorialCaption>
          </motion.div>

          <motion.div variants={riseItem} className="max-w-3xl">
            <EditorialHeading size="hero" className="mb-4">
              Lass uns etwas <em className="italic kinetic-underline text-[color:var(--color-planer-accent)]">vorhaben</em>.
            </EditorialHeading>
          </motion.div>

          <motion.div variants={riseItem} className="mt-6 flex flex-wrap items-center gap-4 max-w-2xl">
            <p className="text-[15px] text-[color:var(--color-planer-dim)] leading-relaxed flex-1 min-w-[16rem]">
              Hier werden aus vagen Ideen geteilte Abende. Plane, lade ein, chattet euch warm —
              und findet euch dann wirklich.
            </p>
            <PlanerButton
              onClick={() => setShowCreate(true)}
              size="lg"
              variant="primary"
              className="shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
              </svg>
              Neues Treffen planen
            </PlanerButton>
          </motion.div>

          {/* Decorative hairline */}
          <motion.div variants={riseItem} className="hairline-accent mt-10" />
        </motion.section>

        {/* LOADING */}
        {loadingEvents ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-[22px] bg-[color:var(--color-planer-surface)] border border-white/[0.04] h-44 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
            {/* Upcoming — all cards uniform, first one gets a subtle marker */}
            {upcoming.length > 0 && (
              <section>
                <motion.div variants={riseItem} className="mb-4 flex items-baseline justify-between">
                  <EditorialCaption>Kommende Treffen</EditorialCaption>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-planer-whisper)]">
                    <span className="tabular">{String(upcoming.length).padStart(2, '0')}</span>
                  </span>
                </motion.div>

                {/* "↓ Als nächstes" caption sits above the first card —
                    marks hierarchy via position + accent, never via size. */}
                {upcoming.length > 0 && (
                  <motion.div
                    variants={riseItem}
                    className="flex items-center gap-2 mb-3 ml-1"
                  >
                    <span className="text-[color:var(--color-planer-accent)] text-sm leading-none">↓</span>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--color-planer-accent)] font-medium">
                      Als nächstes
                    </span>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcoming.map((ev, i) => (
                    <PlanCard key={ev.id} plan={ev} isNext={i === 0} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Past — more muted */}
            {past.length > 0 && (
              <motion.section variants={riseItem} className="mt-12">
                <div className="mb-4 flex items-baseline justify-between">
                  <EditorialCaption>Erinnerungen</EditorialCaption>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-planer-whisper)]">
                    <span className="tabular">{String(past.length).padStart(2, '0')}</span> vergangen
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 hover:opacity-100 transition-opacity duration-700">
                  {past.map((ev, i) => (
                    <PlanCard key={ev.id} plan={ev} index={i} />
                  ))}
                </div>
              </motion.section>
            )}
          </motion.div>
        )}
      </main>

      {/* Create flow takeover */}
      {user && (
        <CreatePlanFlow
          open={showCreate}
          onClose={() => setShowCreate(false)}
          supabase={supabase}
          user={user}
          friends={friends}
        />
      )}
    </PlanerShell>
  );
}

// ─── Empty state — editorial quote + gentle CTA ───

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}
      className="py-10 sm:py-20 text-center max-w-xl mx-auto"
    >
      <svg
        className="w-16 h-16 mx-auto mb-8 text-[color:var(--color-planer-accent)]/60"
        viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="0.8"
      >
        <circle cx="24" cy="24" r="22" strokeDasharray="2 3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M24 12v12l8 4" />
      </svg>

      <EditorialHeading size="section" className="mb-4">
        Die <em className="italic text-[color:var(--color-planer-accent)]">erste</em> Einladung<br />
        schreibt sich von selbst.
      </EditorialHeading>

      <p className="text-[color:var(--color-planer-dim)] mb-8 leading-relaxed italic">
        „Spontan ist ein Wort, das stillere Planung nicht ausschließt."
      </p>

      <PlanerButton onClick={onCreate} size="lg" variant="primary">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
        </svg>
        Erstes Treffen planen
      </PlanerButton>
    </motion.div>
  );
}
