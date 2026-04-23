/**
 * POST /api/notifications/dispatch
 *
 * Central fan-out endpoint that inserts `notifications` rows AND fires
 * Web-Push in one shot. Two modes:
 *
 *   — Single recipient:  { target: { userId } }
 *   — Group broadcast:   { target: { groupId, excludeSelf?: true } }
 *
 * Both accept the same payload fields: type, title, body, actionUrl.
 * The caller MUST be authenticated; for group broadcasts we verify the
 * caller is a member of the target group.
 *
 * The notifications insert happens via the caller's cookie-scoped client
 * (RLS applies), while push delivery uses a service-role client so we can
 * read subscriptions regardless of who owns them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendPushToSubscriptions, isPushConfigured, type PushPayload } from '@/lib/push-notifications';

interface DispatchBody {
  target?:
    | { userId: string }
    | { groupId: string; excludeSelf?: boolean };
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  eventId?: string;
}

function isSingleTarget(t: DispatchBody['target']): t is { userId: string } {
  return Boolean(t && 'userId' in t && t.userId);
}
function isGroupTarget(t: DispatchBody['target']): t is { groupId: string; excludeSelf?: boolean } {
  return Boolean(t && 'groupId' in t && t.groupId);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: DispatchBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { target, type, title, body: msgBody, actionUrl, eventId } = body;
  if (!type || !title) {
    return NextResponse.json({ error: 'missing_type_or_title' }, { status: 400 });
  }
  if (!isSingleTarget(target) && !isGroupTarget(target)) {
    return NextResponse.json({ error: 'missing_target' }, { status: 400 });
  }

  // ───────────────────────── Resolve recipients ─────────────────────────
  let recipientIds: string[] = [];
  let groupIdForNotification: string | null = null;

  if (isSingleTarget(target)) {
    recipientIds = [target.userId];
  } else if (isGroupTarget(target)) {
    groupIdForNotification = target.groupId;

    // Verify caller is a member of that group
    const { data: myMembership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', target.groupId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!myMembership) {
      return NextResponse.json({ error: 'not_a_member' }, { status: 403 });
    }

    // Fan out to all members (optionally skipping self)
    const query = supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', target.groupId);
    const { data: members, error: mErr } = await query;
    if (mErr) {
      console.error('[notify/dispatch] members query failed', mErr);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
    const exclude = target.excludeSelf !== false; // default true
    recipientIds = (members ?? [])
      .map(m => m.user_id as string)
      .filter(id => !exclude || id !== user.id);
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  // ───────────────────────── Insert notification rows ─────────────────────────
  const rows = recipientIds.map(uid => ({
    user_id:       uid,
    type,
    title,
    body:          msgBody ?? null,
    from_user_id:  user.id,
    group_id:      groupIdForNotification,
    event_id:      eventId ?? null,
    action_url:    actionUrl ?? null,
  }));
  const { error: insErr } = await supabase.from('notifications').insert(rows);
  if (insErr) {
    console.error('[notify/dispatch] notifications insert failed', insErr);
    return NextResponse.json({ error: 'db_error', detail: insErr.message }, { status: 500 });
  }

  // ───────────────────────── Web-Push fan-out ─────────────────────────
  // Gracefully degrade when VAPID isn't configured — in-app bell still works.
  if (isPushConfigured()) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', recipientIds);

    if (subs && subs.length > 0) {
      const payload: PushPayload = {
        title,
        body:  msgBody,
        url:   actionUrl,
        tag:   groupIdForNotification ? `group-${groupIdForNotification}-${type}` : `user-${recipientIds[0]}-${type}`,
        data:  { groupId: groupIdForNotification, type, actionUrl },
      };
      const { stale } = await sendPushToSubscriptions(subs, payload);
      // Prune dead subscriptions in the background
      if (stale.length > 0) {
        admin.from('push_subscriptions').delete().in('endpoint', stale).then(
          () => {},
          (e: unknown) => console.warn('[notify/dispatch] prune stale failed', e),
        );
      }
    }
  }

  return NextResponse.json({ ok: true, notified: recipientIds.length });
}
