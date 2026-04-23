/**
 * Client-side helper for firing notifications. Wraps /api/notifications/dispatch,
 * which inserts the `notifications` row AND fires Web-Push in one shot.
 *
 * Usage:
 *   await dispatchToUser({ userId, type: 'group_invite', title: '…', body: '…', actionUrl: '/groups/123' });
 *   await dispatchToGroup({ groupId, type: 'group_message', title: '…', body: '…' });
 *
 * Both calls are fire-and-forget from the caller's perspective — we log on
 * failure but never throw, because a missing notification shouldn't break
 * whatever action the user just performed (sending a message, RSVPing, etc).
 */

interface BaseArgs {
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  eventId?: string;
}

export async function dispatchToUser(args: BaseArgs & { userId: string }): Promise<void> {
  await post({ target: { userId: args.userId }, ...args });
}

export async function dispatchToGroup(
  args: BaseArgs & { groupId: string; excludeSelf?: boolean },
): Promise<void> {
  const { groupId, excludeSelf, ...rest } = args;
  await post({ target: { groupId, excludeSelf: excludeSelf ?? true }, ...rest });
}

async function post(body: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch('/api/notifications/dispatch', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText }));
      console.warn('[dispatch] server rejected', res.status, error);
    }
  } catch (e) {
    console.warn('[dispatch] network failure', e);
  }
}
