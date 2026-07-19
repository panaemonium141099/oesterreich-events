import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { MessagesPageClient } from './MessagesPageClient';

/**
 * /messages — direct-message inbox.
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function MessagesPage() {
  await requireUserOrRedirect('/messages');
  return <MessagesPageClient />;
}
