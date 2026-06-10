import Link from 'next/link';
import type { Metadata } from 'next';
import { BusinessLeadForm } from '@/components/Business/BusinessLeadForm';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Für Firmen & Veranstalter — Österreich Events',
  description:
    'Bring deine Events vor tausende Österreicher:innen. Hebe deine Veranstaltung auf der Karte hervor, hol dir ein verifiziertes Firmenprofil oder lass deine Events automatisch von eurer Homepage synchronisieren.',
  alternates: { canonical: '/fuer-firmen' },
};

/* ------------------------------------------------------------------ */
/*  Paket-Definitionen — Preise sind Platzhalter, frei editierbar       */
/* ------------------------------------------------------------------ */

interface Plan {
  id: 'boost' | 'abo' | 'scraper';
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  gradient: string;
  emoji: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'boost',
    name: 'Event-Boost',
    tagline: 'Ein Event, maximale Sichtbarkeit',
    price: '29 €',
    priceNote: 'einmalig pro Event',
    gradient: 'from-amber-500/20 to-orange-500/5',
    emoji: '🚀',
    features: [
      'Dein Event wird auf der Karte hervorgehoben',
      'Niemals in Clustern versteckt — immer einzeln sichtbar',
      'Ganz oben in den Event-Listen & Highlights',
      'Auffälliger Marker mit deinem Branding',
      'Laufzeit 2–4 Wochen rund um dein Event',
    ],
  },
  {
    id: 'abo',
    name: 'Business-Abo',
    tagline: 'Für Veranstalter mit vielen Events',
    price: '49 €',
    priceNote: 'pro Monat',
    gradient: 'from-violet-500/25 to-blue-500/5',
    emoji: '⭐',
    highlight: true,
    features: [
      'Verifiziertes Firmenprofil mit Logo & Galerie',
      'ALLE deine Events automatisch hervorgehoben',
      'Eigene Landingpage unter /firma/dein-name',
      'Bild-Galerie & Beschreibung deines Unternehmens',
      'Priorität im Support',
    ],
  },
  {
    id: 'scraper',
    name: 'Live-Anbindung',
    tagline: 'Eure Events, immer aktuell — automatisch',
    price: 'ab 199 €',
    priceNote: 'Setup, dann im Abo enthalten',
    gradient: 'from-emerald-500/20 to-teal-500/5',
    emoji: '🔗',
    features: [
      'Wir bauen einen Connector für eure Homepage',
      'Eure Events erscheinen automatisch auf der Karte',
      'Immer live & aktuell — kein manuelles Pflegen',
      'Funktioniert mit Kalender-Feeds, Ticket-Seiten & mehr',
      'Inkl. Business-Abo-Vorteile',
    ],
  },
];

const STATS = [
  { value: '141+', label: 'Event-Quellen in ganz Österreich' },
  { value: '9', label: 'Bundesländer abgedeckt' },
  { value: 'Karte', label: 'Interaktive Entdeckung statt Listen' },
];

const STEPS = [
  {
    n: '1',
    title: 'Anfrage stellen',
    text: 'Füll das Formular aus und sag uns, welches Paket dich interessiert. Unverbindlich.',
  },
  {
    n: '2',
    title: 'Wir richten alles ein',
    text: 'Wir melden uns, klären die Details und schalten dein Event oder Profil frei.',
  },
  {
    n: '3',
    title: 'Sichtbar werden',
    text: 'Deine Events erscheinen hervorgehoben auf Karte & Listen — vor tausenden Nutzer:innen.',
  },
];

/* ------------------------------------------------------------------ */
/*  Seite                                                              */
/* ------------------------------------------------------------------ */

export default function FuerFirmenPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm mb-12"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Zurück zur Startseite
        </Link>

        {/* Hero */}
        <header className="max-w-3xl">
          <p className="text-xs tracking-[0.2em] uppercase text-amber-400/80 mb-4">
            Für Firmen & Veranstalter
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Bring deine Events vor tausende Österreicher:innen.
          </h1>
          <p className="text-lg text-white/50 leading-relaxed mb-8">
            Österreich Events ist die interaktive Event-Karte für ganz Österreich.
            Hebe deine Veranstaltung hervor, hol dir ein verifiziertes Firmenprofil
            oder lass deine Events automatisch von eurer Homepage synchronisieren —
            so sind sie immer live und aktuell.
          </p>
          <a
            href="#kontakt"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors"
          >
            Unverbindlich anfragen
          </a>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-16">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-6 text-center">
              <div className="text-2xl md:text-3xl font-bold mb-1">{s.value}</div>
              <div className="text-xs text-white/40 leading-snug">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Boost-Visualisierung */}
        <section className="mt-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">So sticht dein Event heraus</h2>
          <p className="text-white/50 mb-8 max-w-2xl">
            Normale Events werden bei vielen Veranstaltungen zu Clustern zusammengefasst.
            Ein geboostetes Event bleibt <strong className="text-white/80">immer einzeln sichtbar</strong> — mit
            auffälligem Marker, der ins Auge fällt.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Ohne Boost */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <p className="text-xs uppercase tracking-wider text-white/30 mb-6">Ohne Boost</p>
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/50">
                  24
                </div>
                <span className="text-white/30 text-sm">in einem Cluster versteckt</span>
              </div>
            </div>
            {/* Mit Boost */}
            <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
              <p className="text-xs uppercase tracking-wider text-amber-400/80 mb-6">Mit Boost 🚀</p>
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-amber-400/20 blur-md" />
                  <div className="relative w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <span className="text-2xl">🎉</span>
                  </div>
                </div>
                <span className="text-white/80 text-sm font-medium">einzeln & hervorgehoben</span>
              </div>
            </div>
          </div>
        </section>

        {/* Pakete */}
        <section className="mt-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Pakete</h2>
          <p className="text-white/50 mb-8 max-w-2xl">
            Vom einzelnen Event bis zur vollautomatischen Anbindung — wähle, was zu euch passt.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  plan.highlight
                    ? 'border-violet-400/40 bg-gradient-to-b from-violet-500/[0.08] to-transparent'
                    : 'border-white/[0.08] bg-white/[0.02]'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-6 text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-violet-400 text-black">
                    Beliebt
                  </span>
                )}
                {/* Bild-Header (Gradient-Illustration) */}
                <div className={`-mx-6 -mt-6 mb-5 h-28 rounded-t-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                  <span className="text-5xl">{plan.emoji}</span>
                </div>

                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-sm text-white/40 mb-4">{plan.tagline}</p>

                <div className="mb-5">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-white/40 text-sm ml-2">{plan.priceNote}</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={`#kontakt`}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-violet-400 text-black hover:bg-violet-300'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Anfragen
                </a>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30 mt-4">
            Alle Preise zzgl. USt. Individuelle Pakete für größere Veranstalter auf Anfrage.
          </p>
        </section>

        {/* So funktioniert's */}
        <section className="mt-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">So einfach geht's</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {STEPS.map((step) => (
              <div key={step.n} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold mb-4">
                  {step.n}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Kontakt / Lead-Formular */}
        <section className="mt-20 scroll-mt-8" id="kontakt-section">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-10">
            <div className="max-w-xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 text-center">
                Lass uns reden
              </h2>
              <p className="text-white/50 mb-8 text-center">
                Erzähl uns von euren Events — wir finden gemeinsam das passende Paket.
                Unverbindlich und kostenlos.
              </p>
              <BusinessLeadForm />
            </div>
          </div>
        </section>

        {/* Footer-Hinweis */}
        <p className="text-white/30 text-sm mt-12 text-center">
          Fragen vorab? Schreib uns an{' '}
          <a href="mailto:dev@glatzdev.com" className="text-white/60 underline underline-offset-2 hover:text-white transition-colors">
            dev@glatzdev.com
          </a>
        </p>
      </div>
    </div>
  );
}
