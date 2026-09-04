{/* [Vom Anwalt prüfen lassen] */}

import Link from 'next/link';
import type { Metadata } from 'next';
import { deOnlyAlternates } from '@/lib/seo/canonical';

export const revalidate = 86400; // ISR: revalidate every 24 hours

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen — LassTreffen.at',
  description: 'Allgemeine Geschäftsbedingungen für die Nutzung von LassTreffen.at.',
  alternates: deOnlyAlternates('/agb'),
};

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
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

        <h1 className="text-3xl md:text-4xl font-bold mb-8">Allgemeine Geschäftsbedingungen (AGB)</h1>

        <div className="space-y-8 text-white/70 leading-relaxed">
          {/* 1. Geltungsbereich */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Geltungsbereich</h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Plattform
              &quot;LassTreffen.at&quot; (erreichbar unter lasstreffen.at), betrieben von Jonathan Glatz,
              Kreuzgasse 7, 7061 Trausdorf an der Wulka, Österreich (nachfolgend &quot;Betreiber&quot;).
            </p>
            <p className="mt-2">
              Mit der Registrierung und Nutzung der Plattform erklären Sie sich mit diesen AGB einverstanden.
              Sollten Sie mit einzelnen Bestimmungen nicht einverstanden sein, bitten wir Sie, die Plattform
              nicht zu nutzen.
            </p>
          </section>

          {/* 2. Registrierung */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Registrierung und Benutzerkonto</h2>
            <p>
              Für die vollständige Nutzung der Plattform ist eine Registrierung erforderlich. Bei der
              Registrierung sind wahrheitsgemäße Angaben zu machen. Jede Person darf nur ein Benutzerkonto
              anlegen.
            </p>
            <p className="mt-2">
              Sie sind verpflichtet, Ihre Zugangsdaten vertraulich zu behandeln und nicht an Dritte
              weiterzugeben. Für alle Aktivitäten, die über Ihr Konto erfolgen, sind Sie selbst verantwortlich.
              Bei Verdacht auf Missbrauch Ihres Kontos sind Sie verpflichtet, uns unverzüglich zu informieren.
            </p>
            <p className="mt-2">
              Die Registrierung ist erst ab Vollendung des 16. Lebensjahres zulässig.
            </p>
          </section>

          {/* 3. Nutzung der Plattform */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Nutzung der Plattform</h2>
            <p>
              LassTreffen.at ist eine kostenlose Plattform zur Entdeckung von Veranstaltungen in Österreich.
              Die Plattform bietet unter anderem folgende Funktionen:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li>Interaktive Karte mit Veranstaltungsanzeige</li>
              <li>Suche und Filterung von Events nach Kategorie, Ort und Datum</li>
              <li>Soziale Features wie Beiträge, Kommentare und Likes</li>
              <li>Event-Teilnahme und Merkliste</li>
              <li>Personalisierte Event-Empfehlungen</li>
            </ul>
            <p className="mt-3">
              Die Nutzung der Grundfunktionen ist kostenlos. Der Betreiber behält sich das Recht vor,
              einzelne Funktionen zu ändern, zu erweitern oder einzuschränken.
            </p>
          </section>

          {/* 4. User-generated Content */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Nutzergenerierte Inhalte</h2>
            <p>
              Nutzer haben die Möglichkeit, eigene Inhalte auf der Plattform zu veröffentlichen,
              darunter Beiträge, Kommentare, Fotos und Event-Empfehlungen.
            </p>
            <p className="mt-2">
              Sie versichern, dass Sie die erforderlichen Rechte an allen von Ihnen hochgeladenen Inhalten
              besitzen und keine Rechte Dritter verletzen. Mit dem Hochladen räumen Sie dem Betreiber ein
              einfaches, unentgeltliches Nutzungsrecht ein, die Inhalte im Rahmen der Plattform darzustellen
              und zu verbreiten.
            </p>
            <p className="mt-2">
              Der Betreiber ist berechtigt, Inhalte zu entfernen, die gegen diese AGB oder geltendes Recht
              verstoßen, ohne dass es einer vorherigen Ankündigung bedarf.
            </p>
          </section>

          {/* 5. Verhaltensregeln */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Verhaltensregeln</h2>
            <p>Bei der Nutzung der Plattform ist Folgendes untersagt:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li>Das Veröffentlichen von rechtswidrigen, beleidigenden, diskriminierenden oder pornografischen Inhalten</li>
              <li>Spam, Werbung oder kommerzielles Anpreisen ohne Genehmigung</li>
              <li>Das Erstellen gefälschter Events oder irreführender Informationen</li>
              <li>Belästigung, Bedrohung oder Einschüchterung anderer Nutzer</li>
              <li>Das automatisierte Auslesen (Scraping) der Plattforminhalte ohne schriftliche Genehmigung</li>
              <li>Versuche, die technische Infrastruktur der Plattform zu stören oder zu manipulieren</li>
              <li>Die Nutzung mehrerer Konten durch dieselbe Person</li>
            </ul>
            <p className="mt-3">
              Verstöße gegen diese Verhaltensregeln können zur vorübergehenden Sperrung oder endgültigen
              Löschung des Benutzerkontos führen.
            </p>
          </section>

          {/* 6. Haftung */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Haftung</h2>
            <p>
              Die auf der Plattform angezeigten Veranstaltungen werden von Dritten veranstaltet. Der Betreiber
              übernimmt keine Gewähr für die Richtigkeit, Vollständigkeit und Aktualität der angezeigten
              Event-Informationen, einschließlich Datum, Ort, Preis und Verfügbarkeit.
            </p>
            <p className="mt-2">
              Der Betreiber haftet nicht für Schäden, die durch die Teilnahme an Veranstaltungen entstehen.
              Die Haftung des Betreibers ist auf Vorsatz und grobe Fahrlässigkeit beschränkt. Eine Haftung
              für leichte Fahrlässigkeit besteht nur bei Verletzung wesentlicher Vertragspflichten.
            </p>
            <p className="mt-2">
              Für die Verfügbarkeit der Plattform wird keine Garantie übernommen. Ausfälle durch Wartung,
              technische Probleme oder höhere Gewalt begründen keinen Anspruch.
            </p>
          </section>

          {/* 7. Ticketkäufe */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Ticketkäufe</h2>
            <p>
              Ticketkäufe werden über externe Drittanbieter (z.B. oeticket, Eventim) abgewickelt. Bei einem
              Ticketkauf über diese Anbieter kommt der Vertrag ausschließlich zwischen Ihnen und dem jeweiligen
              Ticketanbieter zustande. Der Betreiber ist nicht Vertragspartner und übernimmt keine Haftung
              für den Kauf, die Stornierung oder die Rückerstattung von Tickets.
            </p>
            <p className="mt-2">
              Die AGB und Datenschutzbestimmungen des jeweiligen Ticketanbieters gelten ergänzend. Bitte
              informieren Sie sich vor dem Kauf über die Bedingungen des Anbieters.
            </p>
          </section>

          {/* 8. Geistiges Eigentum */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Geistiges Eigentum</h2>
            <p>
              Alle Inhalte der Plattform, einschließlich Texte, Grafiken, Logos, Icons, Software und Design,
              sind urheberrechtlich geschützt und Eigentum des Betreibers oder der jeweiligen Rechteinhaber.
              Eine Vervielfältigung, Verbreitung oder sonstige Nutzung ohne ausdrückliche schriftliche
              Genehmigung ist untersagt.
            </p>
            <p className="mt-2">
              Event-Daten und -Bilder stammen von den jeweiligen Veranstaltern und Quellen. Die Rechte an
              diesen Inhalten liegen bei den ursprünglichen Rechteinhabern.
            </p>
          </section>

          {/* 9. Kündigung */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Kündigung und Kontolöschung</h2>
            <p>
              Sie können Ihr Benutzerkonto jederzeit und ohne Angabe von Gründen löschen. Die Löschung
              kann über die Kontoeinstellungen oder per E-Mail an dev@glatzdev.com beantragt werden.
            </p>
            <p className="mt-2">
              Der Betreiber ist berechtigt, Benutzerkonten bei Verstößen gegen diese AGB vorübergehend zu
              sperren oder endgültig zu löschen. Betroffene Nutzer werden darüber per E-Mail informiert.
            </p>
            <p className="mt-2">
              Bei Kontolöschung werden Ihre personenbezogenen Daten gemäß unserer Datenschutzerklärung
              innerhalb von 30 Tagen gelöscht. Öffentlich geteilte Inhalte können in anonymisierter Form
              bestehen bleiben.
            </p>
          </section>

          {/* 10. Änderungen der AGB */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Änderungen der AGB</h2>
            <p>
              Der Betreiber behält sich das Recht vor, diese AGB jederzeit zu ändern. Über wesentliche
              Änderungen werden registrierte Nutzer per E-Mail oder durch einen Hinweis auf der Plattform
              informiert. Die fortgesetzte Nutzung der Plattform nach Inkrafttreten geänderter AGB gilt als
              Zustimmung zu den Änderungen.
            </p>
          </section>

          {/* 11. Anwendbares Recht */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Anwendbares Recht</h2>
            <p>
              Es gilt ausschließlich österreichisches Recht unter Ausschluss des UN-Kaufrechts und der
              Verweisungsnormen des internationalen Privatrechts. Zwingende Bestimmungen des Staates,
              in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, bleiben unberührt.
            </p>
          </section>

          {/* 12. Gerichtsstand */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Gerichtsstand</h2>
            <p>
              Für Streitigkeiten aus oder im Zusammenhang mit diesen AGB ist das sachlich zuständige Gericht
              in Eisenstadt, Österreich, zuständig. Für Verbraucher gilt der Gerichtsstand gemäß § 14 KSchG
              (Konsumentenschutzgesetz).
            </p>
          </section>

          {/* 13. Salvatorische Klausel */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Salvatorische Klausel</h2>
            <p>
              Sollte eine Bestimmung dieser AGB unwirksam oder undurchführbar sein oder werden, so bleiben
              die übrigen Bestimmungen davon unberührt. An die Stelle der unwirksamen oder undurchführbaren
              Bestimmung tritt diejenige wirksame und durchführbare Regelung, deren Wirkungen der
              wirtschaftlichen Zielsetzung am nächsten kommen, die die Vertragsparteien mit der unwirksamen
              bzw. undurchführbaren Bestimmung verfolgt haben.
            </p>
          </section>

          {/* Last updated */}
          <p className="text-white/30 text-sm pt-8 border-t border-white/10">
            Zuletzt aktualisiert: 30. März 2026
          </p>
        </div>
      </div>
    </div>
  );
}
