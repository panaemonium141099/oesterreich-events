import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { MessageThreadPageClient } from './MessageThreadPageClient';

/**
 * /messages/[userId] — direct message thread with a specific user.
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  await requireUserOrRedirect(`/messages/${userId}`);
  return <MessageThreadPageClient />;
}
