import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { NotificationsPageClient } from './NotificationsPageClient';

/**
 * /notifications — in-app notification center.
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function NotificationsPage() {
  await requireUserOrRedirect('/notifications');
  return <NotificationsPageClient />;
}
