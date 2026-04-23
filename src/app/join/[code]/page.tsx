'use client';

/**
 * Invite-code redemption flow.
 *
 * /join/XXXXXX → looks up a plan by invite_code, shows a compact
 * preview card, and lets the user join with a single click. On success,
 * redirects to /groups/[id] so the new member lands straight on the
 * dashboard.
 *
 * Auth gate: if the user isn't logged in we bounce to /auth/login?
 * redirect=/join/XXXXXX so they come back here after sign-in.
 *
 * Edge cases handled:
 *   - code doesn't match any plan           → friendly 404 view
 *   - user is already a member              → redirect straight to plan
 *   - user is the owner (own code)          → redirect (harmless)
 *   - DB error during the insert            → surface toast, stay on page
 *
 * We also write a join activity + notify the owner so they see new
 * members appear in their plan's Chronik.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import {
  PlanerShell,
  PlanerButton,
  EditorialCaption,
  EditorialHeading,
} from '@/components/Planer/primitives';
import { riseItem, staggerContainer } from '@/components/Planer/motion';

type State =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'preview'; plan: PlanPreview }
  | { kind: 'joining'; plan: PlanPreview }
  | { kind: 'error'; message: string };

interface PlanPreview {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  location_name: string | null;
  image_url: string | null;
  event_type: string;
  created_by: string;
  member_count: number;
  owner?: { first_name: string; last_name: string; avatar_url: string | null };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return date;
  return `${date} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function JoinPage() {
  const params = useParams();
  const rawCode = ((params.code as string) ?? '').toUpperCase().trim();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [state, setState] = useState<State>({ kind: 'loading' });

  // Redirect to login if unauthenticated — preserve code in the redirect param.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const redirect = encodeURIComponent(`/join/${rawCode}`);
      router.replace(`/auth/login?redirect=${redirect}`);
    }
  }, [authLoading, user, rawCode, router]);

  // Look up plan by code + check existing membership
  useEffect(() => {
    if (authLoading || !user || !rawCode) return;

    (async () => {
      // 1. Find plan by invite_code
      const { data: plan, error } = await supabase
        .from('groups')
        .select('id, name, description, event_date, location_name, image_url, event_type, created_by')
        .eq('invite_code', rawCode)
        .maybeSingle();

      if (error) { setState({ kind: 'error', message: error.message }); return; }
      if (!plan) { setState({ kind: 'not_found' }); return; }

      // 2. Already a member? → straight to the plan
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', plan.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) { router.replace(`/groups/${plan.id}`); return; }

      // 3. Fetch a few extras for the preview card (owner profile + member count)
      const [{ data: ownerProfile }, { count }] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', plan.created_by)
          .maybeSingle(),
        supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', plan.id),
      ]);

      setState({
        kind: 'preview',
        plan: {
          ...(plan as PlanPreview),
          owner: ownerProfile ?? undefined,
          member_count: count ?? 0,
        },
      });
    })();
  }, [authLoading, user, rawCode, router, supabase]);

  const handleJoin = async () => {
    if (state.kind !== 'preview' || !user) return;
    const plan = state.plan;
    setState({ kind: 'joining', plan });

    // 1. Insert membership
    const { error: memberErr } = await supabase
      .from('group_members')
      .insert({
        group_id: plan.id,
        user_id: user.id,
        role: 'member',
        rsvp: 'pending',
      });
    if (memberErr) {
      console.error('[join] insert failed:', memberErr);
      toast.error(`Beitreten fehlgeschlagen: ${memberErr.message}`);
      setState({ kind: 'preview', plan });
      return;
    }

    // 2. Fire-and-forget side effects (join activity + owner notification).
    // We don't await errors from these — the join itself already succeeded,
    // missing activity rows are a minor issue, not worth blocking the UX.
    void Promise.all([
      supabase.from('activities').insert({
        user_id: user.id,
        type: 'group_joined',
        group_id: plan.id,
        metadata: { via: 'invite_code', code: rawCode },
      }),
      supabase.from('notifications').insert({
        user_id: plan.created_by,
        type: 'group_join',
        title: 'Neuer Teilnehmer',
        body: `Jemand ist deinem Plan „${plan.name}" über den Einladungs-Code beigetreten.`,
        from_user_id: user.id,
        group_id: plan.id,
        action_url: `/groups/${plan.id}`,
      }),
    ]).catch(err => console.warn('[join] side-effects failed (non-fatal):', err));

    // 3. Land on the plan dashboard
    router.replace(`/groups/${plan.id}`);
  };

  // ── Render ──
  if (authLoading || state.kind === 'loading') {
    return (
      <PlanerShell>
        <main className="max-w-xl mx-auto px-6 py-16">
          <div className="h-4 w-24 rounded bg-white/[0.04] mb-4 animate-pulse" />
          <div className="h-10 w-64 max-w-full rounded bg-white/[0.04] mb-10 animate-pulse" />
          <div className="h-48 rounded-2xl bg-white/[0.03] animate-pulse" />
        </main>
      </PlanerShell>
    );
  }

  if (state.kind === 'not_found') {
    return (
      <PlanerShell>
        <main className="max-w-xl mx-auto px-6 py-16">
          <EditorialCaption className="mb-3">Code unbekannt</EditorialCaption>
          <EditorialHeading size="section" className="mb-4">
            Diesen Einladungs-Code gibt's nicht.
          </EditorialHeading>
          <p className="text-sm text-[color:var(--color-planer-dim)] mb-8 leading-relaxed">
            Der Code <span className="font-mono bg-white/5 px-2 py-0.5 rounded">{rawCode}</span> führt zu keinem Plan.
            Eventuell falsch abgetippt, oder der Plan wurde bereits gelöscht.
          </p>
          <Link href="/groups">
            <PlanerButton variant="outline" size="md">
              Zurück zu meinen Plänen
            </PlanerButton>
          </Link>
        </main>
      </PlanerShell>
    );
  }

  if (state.kind === 'error') {
    return (
      <PlanerShell>
        <main className="max-w-xl mx-auto px-6 py-16">
          <EditorialCaption className="mb-3 text-[color:var(--color-planer-rose)]/80">Fehler</EditorialCaption>
          <EditorialHeading size="section" className="mb-4">
            Da lief was schief.
          </EditorialHeading>
          <p className="text-sm text-[color:var(--color-planer-dim)] mb-6 leading-relaxed">
            {state.message}
          </p>
          <Link href="/groups">
            <PlanerButton variant="outline" size="md">Zurück</PlanerButton>
          </Link>
        </main>
      </PlanerShell>
    );
  }

  // preview OR joining
  const plan = state.plan;
  const busy = state.kind === 'joining';
  const dateLabel = formatDate(plan.event_date);

  return (
    <PlanerShell>
      <motion.main
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-xl mx-auto px-6 py-16"
      >
        <motion.div variants={riseItem}>
          <EditorialCaption className="mb-3">Einladung</EditorialCaption>
          <EditorialHeading size="section" className="mb-3">
            Du wurdest eingeladen.
          </EditorialHeading>
          <p className="text-sm text-[color:var(--color-planer-dim)] mb-8 leading-relaxed">
            Der Einladungs-Code <span className="font-mono bg-white/5 px-2 py-0.5 rounded">{rawCode}</span> führt
            zu diesem Plan. Ein Klick und du bist dabei.
          </p>
        </motion.div>

        {/* Preview card — same design language as PlanCard on the hub */}
        <motion.div
          variants={riseItem}
          className="rounded-[22px] overflow-hidden border border-white/[0.06] bg-[color:var(--color-planer-surface)] mb-6"
          style={{ boxShadow: '0 14px 40px -20px rgba(0,0,0,0.5)' }}
        >
          {plan.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plan.image_url} alt="" className="w-full h-40 object-cover" />
          )}
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded-full border border-[color:var(--color-planer-accent)]/30 text-[color:var(--color-planer-accent)]/90 bg-[color:var(--color-planer-accent)]/8">
                {plan.event_type === 'existing_event' ? 'Öffentliches Event' : 'Privater Plan'}
              </span>
            </div>

            <h2 className="serif-display text-[24px] sm:text-[28px] font-light text-[color:var(--color-planer-ink)] leading-tight mb-3">
              {plan.name}
            </h2>

            {plan.description && (
              <p className="text-sm text-[color:var(--color-planer-dim)] mb-4 leading-relaxed line-clamp-3">
                {plan.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[color:var(--color-planer-dim)]">
              {dateLabel && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[color:var(--color-planer-accent)]/80" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm0 6h10v8H7v-8z" />
                  </svg>
                  {dateLabel}
                </span>
              )}
              {plan.location_name && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[color:var(--color-planer-accent)]/80" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a8 8 0 00-8 8c0 5.4 7 11.5 7.3 11.8.4.3.9.3 1.3 0C13 21.5 20 15.4 20 10a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                  </svg>
                  {plan.location_name}
                </span>
              )}
              <span>{plan.member_count} {plan.member_count === 1 ? 'Teilnehmer:in' : 'Teilnehmer:innen'}</span>
            </div>

            {plan.owner && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2.5 text-xs text-[color:var(--color-planer-whisper)]">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[10px] text-white/60">
                  {plan.owner.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={plan.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                    : plan.owner.first_name[0]?.toUpperCase() || '?'}
                </div>
                <span>Erstellt von {plan.owner.first_name} {plan.owner.last_name}</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={riseItem} className="flex items-center justify-between gap-3">
          <Link href="/groups" className="text-sm text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] transition-colors">
            Zurück
          </Link>
          <PlanerButton onClick={handleJoin} variant="primary" size="lg" loading={busy}>
            Plan beitreten
          </PlanerButton>
        </motion.div>
      </motion.main>
    </PlanerShell>
  );
}
