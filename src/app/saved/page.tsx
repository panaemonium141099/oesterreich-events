import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { SavedPageClient } from './SavedPageClient';

/**
 * /saved — bookmarked events.
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function SavedPage() {
  await requireUserOrRedirect('/saved');
  return <SavedPageClient />;
}
