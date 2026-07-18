import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { V4SavedPageClient } from './V4SavedPageClient';

/**
 * /saved — Meine Pläne (v4 Phase 5).
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function SavedPage() {
  await requireUserOrRedirect('/saved');
  return <V4SavedPageClient />;
}
