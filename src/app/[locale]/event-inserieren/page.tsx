import Link from 'next/link';
import type { Metadata } from 'next';
import { EventSubmissionForm } from '@/components/Events/EventSubmissionForm';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Event inserieren — kostenlos eintragen | LassTreffen.at',
  description:
    'Trag deine Veranstaltung kostenlos auf LassTreffen.at ein. Konzert, Fest, Markt oder Vereinsabend — wir prüfen jedes Inserat von Hand und veröffentlichen es auf Karte, Themenseiten und in der Suche.',
  alternates: { canonical: '/event-inserieren' },
};

/**
 * /event-inserieren — öffentliches Inserat-Formular, verlinkt im Footer.
 *
 * Statisch (revalidate 1 Tag): die Seite hat keinen nutzerabhängigen
 * Inhalt, das Formular ist eine Client-Insel. Kein cookies()/auth im
 * RSC-Pfad — sonst fällt die Seite aus dem Prerendering (siehe
 * CLAUDE.md, Landing-Statik).
 */
export default function EventInserierenPage() {
  return (
    // Kein eigener Kopfbereich: Logo und Navigation kommen global aus
    // V4TopNav. Eine zweite Zeile mit Zurück-Link wäre eine Dublette.
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Event inserieren
        </h1>
        <p className="text-white/50 leading-relaxed mb-3">
          Konzert, Dorffest, Lesung, Flohmarkt oder Vereinsabend — trag deine
          Veranstaltung hier ein. Das Inserat ist kostenlos.
        </p>
        <p className="text-white/35 text-sm leading-relaxed mb-10">
          Nach dem Absenden prüfen wir die Angaben von Hand. Passt alles, erscheint
          dein Event auf der Karte, den Themen- und Ortsseiten und in der Suche — und
          du bekommst eine E-Mail mit dem Link. Für laufend synchronisierte Events
          und hervorgehobene Platzierungen gibt es{' '}
          <Link href="/fuer-firmen" className="underline hover:text-white/60 transition-colors">
            Pakete für Veranstalter
          </Link>
          .
        </p>

        <EventSubmissionForm />
      </main>
    </div>
  );
}
