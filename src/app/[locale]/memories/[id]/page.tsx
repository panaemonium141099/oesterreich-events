import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { MemoryDetailPageClient } from './MemoryDetailPageClient';

/**
 * /memories/[id] — single memory (photo album + participants) view.
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUserOrRedirect(`/memories/${id}`);
  return <MemoryDetailPageClient />;
}
