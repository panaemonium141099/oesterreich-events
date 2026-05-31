import type { Metadata } from 'next';
import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { GemerktPageClient } from './GemerktPageClient';

export const metadata: Metadata = {
  title: 'Gemerkte Events — lasstreffen.at',
  description: 'Alle Events, die du dir gemerkt hast — an einem Ort.',
  robots: { index: false, follow: false }, // private user area
};

/**
 * /gemerkt — pure bookmark list.
 *
 * Separate from /saved (which hosts the Plans/Reminders UI). User wanted
 * "Gespeicherte Events" in the profile dropdown to be a flat list of
 * what they hit "Merken" on — not the planning workspace.
 */
export default async function GemerktPage() {
  await requireUserOrRedirect('/gemerkt');
  return <GemerktPageClient />;
}
