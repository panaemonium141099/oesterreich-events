import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { CreateEventPageClient } from './CreateEventPageClient';

/**
 * /events/create — user-submitted event creation form.
 *
 * Server-side auth-gate; creating events requires a logged-in user.
 * Anonymous visitors get a 307 to /auth/login with
 * ?returnTo=/events/create.
 */
export default async function CreateEventPage() {
  await requireUserOrRedirect('/events/create');
  return <CreateEventPageClient />;
}
