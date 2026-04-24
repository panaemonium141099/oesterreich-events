import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { MemoriesPageClient } from './MemoriesPageClient';

/**
 * /memories — personal + group memory archive.
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function MemoriesPage() {
  await requireUserOrRedirect('/memories');
  return <MemoriesPageClient />;
}
