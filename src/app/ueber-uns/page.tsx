import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: 'Über uns — LassTreffen.at' },
  description:
    'LassTreffen.at ist die unabhängige Event-Discovery-Plattform für Österreich. Wer wir sind, wie wir Veranstaltungen sammeln und kuratieren, und warum wir diese Plattform gebaut haben.',
  alternates: {
    canonical: 'https://lasstreffen.at/ueber-uns',
  },
  openGraph: {
    title: 'Über LassTreffen.at',
    description:
      'Eine unabhängige, von Studenten entwickelte Plattform, die rund 80.000 Veranstaltungen in Österreich auf einer interaktiven Karte bündelt.',
    type: 'website',
    url: 'https://lasstreffen.at/ueber-uns',
  },
};

export default function UeberUnsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <article className="max-w-3xl mx-auto px-6 py-16 md:py-24">

        {/* Back nav */}
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

        {/* H1 */}
        <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight tracking-tight">
          Über LassTreffen.at
        </h1>
        <p className="text-lg md:text-xl text-white/60 leading-relaxed mb-16">
          Eine unabhängige Event-Discovery-Plattform für Österreich —
          gebaut, weil es sowas ernsthaft noch nicht gibt.
        </p>

        {/* Content blocks */}
        <div className="space-y-12 text-white/70 leading-relaxed text-base md:text-lg">

          {/* Warum */}
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Warum es diese Seite gibt
            </h2>
            <p className="mb-4">
              Ich heiße <span className="text-white">Jonathan Glatz</span> und studiere an der
              Fachhochschule Burgenland. 2025 habe ich versucht, mit Freunden ein paar coole
              Events für ein Wochenende zu finden — und gemerkt, dass es für österreichische
              Veranstaltungen keinen zentralen Ort gibt. Tickets liegen auf oeticket, Eventim
              und hundert kleinen Ticket-Vendors. Gemeinde-Events leben auf
              &nbsp;
              <Link href="/quellen" className="underline underline-offset-2 text-white/90 hover:text-white">Gemeinde-Websites</Link>
              . Nightlife-Termine stehen in Instagram-Stories. Festival-Lineups kommen als PDF.
            </p>
            <p>
              LassTreffen.at ist der Versuch, das auf einer interaktiven Karte zusammenzuführen —
              mit einer Kategorie- und Wizard-Logik, die eine Studentin in Graz anders suchen
              lässt als eine Familie in Tirol. Die Plattform läuft seit Anfang 2026 öffentlich
              und wächst jede Woche.
            </p>
          </section>

          {/* Wie wir arbeiten */}
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Wie wir Events sammeln
            </h2>
            <p className="mb-4">
              Hinter der Seite laufen rund <span className="text-white">140 individuelle Scraper</span>,
              die täglich Veranstaltungsdaten aus offiziellen Quellen ziehen: Austria Tourism,
              Feratel-Deskline-Portale (zB Salzkammergut, Wörthersee, Zillertal), über 2000
              österreichische Gemeinde-Websites via CMS-Konnektoren, Ticket-Vendors wie oeticket
              und Ö-Ticket, Universitäts-Kalender aller 56 österreichischen Hochschulen, und die
              wichtigsten Club- und Festival-Portale der Republik.
            </p>
            <p className="mb-4">
              Gesammelt wird nur das, was rechtlich erlaubt ist: offene Daten (Creative Commons,
              Open Government Data), ICS-Kalender, JSON-LD-strukturierte Event-Schemas auf
              öffentlichen Seiten, und RSS-Feeds. Jede Quelle ist auf unserer&nbsp;
              <Link href="/quellen" className="underline underline-offset-2 text-white/90 hover:text-white">Quellen-Seite</Link>
              &nbsp;dokumentiert.
            </p>
            <p>
              Aggregiert sind wir nur insoweit, wie Google News es auch ist: wir verlinken immer
              auf die Originalquelle, verkaufen keine Tickets selbst, und zeigen die Inhalte in
              einem Kontext, den die Originalseiten nicht bieten — nämlich gebündelt, gefiltert
              und geografisch.
            </p>
          </section>

          {/* Redaktion & Technik */}
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Redaktion und Technik
            </h2>
            <p className="mb-4">
              Die Rohdaten durchlaufen eine mehrstufige Pipeline:
            </p>
            <ol className="space-y-2 list-decimal list-inside pl-1 mb-4">
              <li><span className="text-white">Normalisierung</span> von Datumsformaten, Orten
                und Titeln — damit ein und derselbe Kirtag nicht dreimal als Duplikat erscheint.</li>
              <li><span className="text-white">Deduplizierung</span> über Fingerprint und
                Jaro-Winkler-Fuzzy-Matching. Losers werden nicht gelöscht, sondern als Duplikat
                markiert und auf den Hauptdatensatz weitergeleitet.</li>
              <li><span className="text-white">Kategorisierung</span> über einen
                regelbasierten Klassifikator (rund 200 präzise Token- und Phrasen-Regeln in
                Deutsch) plus einer KI-Anreicherung, die Genres, Zielgruppen, Vibe, Setting
                und Sprache pro Event zuordnet.</li>
              <li><span className="text-white">Qualitätsfilter</span>: Events mit zu dünnen
                Daten, offensichtlichen Scraper-Fehlern (Navigations-Labels als Titel,
                leere Zeitangaben) oder aus nicht mehr lebenden URLs werden automatisch
                aussortiert.</li>
            </ol>
            <p>
              Ich überprüfe die Auswertungen regelmäßig händisch und passe die Regeln an, wenn
              neue Quellen dazukommen. Die Plattform ist bewusst kein reiner Algorithmus-Dienst
              — entscheidend ist, dass der redaktionelle Prozess dokumentiert und nachvollziehbar
              ist.
            </p>
          </section>

          {/* Finanzierung */}
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Wie wir uns finanzieren
            </h2>
            <p className="mb-4">
              Die Plattform ist kostenlos für Nutzer und soll das auch bleiben. Damit
              der Betrieb und die Weiterentwicklung sich tragen, setzen wir auf zwei
              transparente Einnahmequellen:
            </p>
            <ul className="space-y-3 list-disc list-inside pl-1">
              <li>
                <span className="text-white">Display-Werbung</span> (Google AdSense):
                standardisierte Werbeanzeigen, klar als Werbung gekennzeichnet und
                optisch vom redaktionellen Inhalt getrennt. Welche Anzeigen wer sieht,
                entscheidet Google — wir haben keinen Einfluss darauf und bekommen auch
                keine personenbezogenen Daten dazu.
              </li>
              <li>
                <span className="text-white">Affiliate-Links</span> (oeticket, Eventim,
                weitere): wenn ihr über unsere Ticket-Buttons zu einem Vendor wechselt
                und dort ein Ticket kauft, erhalten wir eine kleine Provision vom
                Vendor. <span className="text-white">Für euch ändert sich am Preis
                nichts.</span> Die Ticketabwicklung läuft weiter komplett beim
                jeweiligen Vendor, wir bekommen nur eine Transaktions-Bestätigung.
              </li>
            </ul>
          </section>

          {/* Was wir nicht tun */}
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Was wir bewusst nicht tun
            </h2>
            <ul className="space-y-2 list-disc list-inside pl-1">
              <li>Wir verkaufen keine Tickets selbst. Kauf und Abwicklung laufen
                immer über den jeweiligen Original-Vendor.</li>
              <li>
                <span className="text-white">Event-Ranking ist nicht käuflich.</span>
                Die Reihenfolge der angezeigten Events richtet sich ausschließlich nach
                unserem Quality-Score (Vollständigkeit der Daten, Qualität der Quelle,
                Aktualität). Ein großer Ticket-Vendor wird gleich bewertet wie ein
                Dorffest im Burgenland — wer höher platziert ist, hat die besseren
                Daten, nicht die höhere Provision.
              </li>
              <li>Wir leiten keine persönlichen Daten an Dritte weiter (über das
                hinaus, was Google AdSense zur reinen Anzeigen-Auslieferung braucht).
                Details und Opt-out-Möglichkeiten siehe&nbsp;
                <Link href="/datenschutz" className="underline underline-offset-2 text-white/90 hover:text-white">Datenschutz</Link>.
              </li>
              <li>Wir akzeptieren keine gesponserten oder bezahlten Event-Einträge
                ohne sichtbare Kennzeichnung. Falls ein Veranstalter jemals zahlt,
                um einen Eintrag prominent zu platzieren, wird das explizit als
                „Gesponsert" markiert.</li>
            </ul>
          </section>

          {/* Kontakt */}
          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Kontakt &amp; Feedback
            </h2>
            <p className="mb-4">
              Wenn euch ein Event fehlt, ein Fehler auffällt, oder ihr als Veranstalter
              sichergehen wollt, dass eure Termine korrekt erfasst werden — schreibt mir
              direkt an&nbsp;
              <a
                href="mailto:dev@glatzdev.com"
                className="underline underline-offset-2 text-white/90 hover:text-white"
              >
                dev@glatzdev.com
              </a>
              . Antworten gibt&apos;s in der Regel binnen 48 Stunden.
            </p>
            <p>
              Für Kooperationsanfragen von Ticketvendors, Veranstaltern und
              Tourismus-Organisationen: gleiche E-Mail, gerne mit grobem Kontext im Betreff.
            </p>
          </section>

          {/* Impressum quick-link */}
          <section className="pt-6 border-t border-white/10">
            <p className="text-sm text-white/40">
              Vollständige rechtliche Angaben und Betreiberinformationen findest du im&nbsp;
              <Link
                href="/impressum"
                className="underline underline-offset-2 hover:text-white/70"
              >
                Impressum
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
