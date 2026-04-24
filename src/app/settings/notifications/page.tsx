import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { NotificationsSettingsPageClient } from './NotificationsSettingsPageClient';

/**
 * /settings/notifications — notification preferences (email/SMS/Push).
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function NotificationsSettingsPage() {
  await requireUserOrRedirect('/settings/notifications');
  return <NotificationsSettingsPageClient />;
}
