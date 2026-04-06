'use client';

/**
 * /settings/notifications page
 *
 * Renders the NotificationPreferences component within a settings layout.
 * Provides navigation back to profile and to artist management.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.10
 */

import Link from 'next/link';
import NotificationPreferences from '@/components/Settings/NotificationPreferences';
import { SocialNav } from '@/components/Layout/SocialNav';

export default function NotificationSettingsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/profile"
            className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Zurueck zum Profil
          </Link>
          <Link
            href="/artists"
            className="text-sm text-indigo-400 transition hover:text-indigo-300"
          >
            Kuenstler verwalten
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Benachrichtigungseinstellungen</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Verwalte deine Benachrichtigungskanaele und Erinnerungen.
          </p>
        </div>

        <NotificationPreferences />
      </main>

      <SocialNav />
    </div>
  );
}
