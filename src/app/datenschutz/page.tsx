{/* [Vom Anwalt prüfen lassen] */}

import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 86400; // ISR: revalidate every 24 hours

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — LassTreffen.at',
  description: 'Datenschutzerklärung und Informationen zur Verarbeitung personenbezogener Daten.',
};

export default function DatenschutzPage() {
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

        <h1 className="text-3xl md:text-4xl font-bold mb-8">Datenschutzerklärung</h1>

        <div className="space-y-8 text-white/70 leading-relaxed">
          {/* 1. Verantwortlicher */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Verantwortlicher</h2>
            <p>
              Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
            </p>
            <p className="mt-2">
              Jonathan Glatz<br />
              Kreuzgasse 7<br />
              7061 Trausdorf an der Wulka<br />
              Österreich
            </p>
            <p className="mt-2">
              E-Mail:{' '}
              <a href="mailto:dev@glatzdev.com" className="text-white/90 underline underline-offset-2 hover:text-white transition-colors">
                dev@glatzdev.com
              </a>
            </p>
          </section>

          {/* 2. Welche Daten wir erheben */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Welche Daten wir erheben</h2>
            <p>Im Rahmen der Nutzung unserer Plattform können folgende personenbezogene Daten erhoben werden:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li><span className="text-white/90">Kontodaten:</span> Name (Vor- und Nachname), E-Mail-Adresse, Passwort (verschlüsselt)</li>
              <li><span className="text-white/90">Profildaten:</span> Geburtsdatum, Telefonnummer, Adresse (Straße, PLZ, Ort, Land)</li>
              <li><span className="text-white/90">Standortdaten:</span> Ungefährer Standort (nur bei ausdrücklicher Zustimmung, zur Anzeige nahegelegener Events)</li>
              <li><span className="text-white/90">Nutzungsdaten:</span> Aufgerufene Seiten, Interaktionen mit Events, Suchbegriffe, Zeitpunkt und Dauer des Zugriffs</li>
              <li><span className="text-white/90">Social-Features:</span> Erstellte Beiträge, Kommentare, Likes, Event-Teilnahmen</li>
              <li><span className="text-white/90">Technische Daten:</span> IP-Adresse, Browsertyp, Betriebssystem, Gerätetyp</li>
            </ul>
          </section>

          {/* 3. Rechtsgrundlage */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Rechtsgrundlage der Verarbeitung</h2>
            <p>Die Verarbeitung Ihrer personenbezogenen Daten erfolgt auf Grundlage folgender Rechtsgrundlagen gemäß Art. 6 Abs. 1 DSGVO:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li><span className="text-white/90">Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):</span> Für die Verarbeitung von Standortdaten, Newsletter-Versand und optionale Verknüpfungen mit Drittdiensten (z.B. Spotify).</li>
              <li><span className="text-white/90">Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</span> Für die Bereitstellung des Benutzerkontos, der Plattformfunktionen und der Event-Entdeckung.</li>
              <li><span className="text-white/90">Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO):</span> Für die Analyse zur Verbesserung unseres Dienstes, Betrugsprävention und technische Sicherheit.</li>
            </ul>
          </section>

          {/* 4. Zweck der Datenverarbeitung */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Zweck der Datenverarbeitung</h2>
            <p>Wir verarbeiten Ihre Daten zu folgenden Zwecken:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li>Bereitstellung und Verwaltung Ihres Benutzerkontos</li>
              <li>Anzeige und Empfehlung relevanter Events basierend auf Ihren Interessen und Ihrem Standort</li>
              <li>Ermöglichung sozialer Features (Beiträge, Kommentare, Likes, Event-Teilnahmen)</li>
              <li>Verbesserung und Weiterentwicklung der Plattform durch anonymisierte Nutzungsanalysen</li>
              <li>Versand von Event-Empfehlungen und Neuigkeiten per E-Mail (nur bei ausdrücklicher Zustimmung)</li>
              <li>Gewährleistung der technischen Sicherheit und Stabilität</li>
            </ul>
          </section>

          {/* 5. Cookies und Tracking */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Cookies und Tracking</h2>
            <p>Unsere Website verwendet folgende Arten von Cookies:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li><span className="text-white/90">Notwendige Cookies:</span> Erforderlich für die Grundfunktionalität der Website (Session-Verwaltung, Authentifizierung). Diese Cookies können nicht deaktiviert werden.</li>
            </ul>
            <p className="mt-3">
              Derzeit setzen wir <strong>keine Analyse- und keine Werbenetzwerk-Cookies</strong>
              ein. Die Reichweitenmessung erfolgt ausschließlich über das cookielose
              Vercel-Analytics (siehe Abschnitt 6). Sollten zukünftig Analyse- oder
              Marketing-Cookies eingeführt werden, werden diese ausschließlich nach
              ausdrücklicher Einwilligung gesetzt und an dieser Stelle dokumentiert.
            </p>
            <p className="mt-3">
              Sie können Cookies jederzeit in Ihren Browsereinstellungen verwalten oder löschen.
            </p>
          </section>

          {/* 6. Drittanbieter */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Drittanbieter und Auftragsverarbeiter</h2>
            <p>Zur Bereitstellung unserer Dienste setzen wir folgende Drittanbieter ein:</p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Supabase (Datenbank & Authentifizierung)</h3>
            <p>
              Wir verwenden Supabase für die Datenspeicherung und Benutzerauthentifizierung.
              Die Daten werden auf Servern in Frankfurt am Main (EU) gespeichert.
              Anbieter: Supabase Inc., USA. Es besteht ein Auftragsverarbeitungsvertrag.
            </p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Mapbox (Kartendienst)</h3>
            <p>
              Für die Darstellung der interaktiven Karte verwenden wir Mapbox. Dabei können technische Daten
              (IP-Adresse, Standortdaten bei Nutzung) an Mapbox übertragen werden.
              Anbieter: Mapbox Inc., USA. Die Datenübertragung erfolgt auf Basis von Standardvertragsklauseln
              gemäß Art. 46 Abs. 2 lit. c DSGVO.
            </p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Google OAuth (Anmeldung)</h3>
            <p>
              Wir bieten die Anmeldung über Google an. Dabei werden Ihr Name und Ihre E-Mail-Adresse von Google
              an uns übermittelt. Anbieter: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.
              Weitere Informationen finden Sie in der Datenschutzerklärung von Google.
            </p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Spotify (optionale Verknüpfung)</h3>
            <p>
              Sie haben die Möglichkeit, Ihr Spotify-Konto mit LassTreffen.at zu verknüpfen, um
              musikbezogene Empfehlungen zu erhalten. Diese Verknüpfung ist freiwillig und kann jederzeit
              in den Kontoeinstellungen widerrufen werden.
              Anbieter: Spotify AB, Schweden.
            </p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Reichweitenmessung (Vercel Analytics)</h3>
            <p>
              Wir nutzen Vercel Analytics zur cookielosen, anonymen Messung der Reichweite und
              Nutzung unserer Website. Anbieter: Vercel Inc., 340 S Lemon Ave #4133, Walnut,
              CA 91789, USA. Es werden keine Cookies gesetzt, keine personenbezogenen Daten
              gespeichert und kein Tracking-Profil erstellt — gemessen werden ausschließlich
              aggregierte Seitenaufrufe und Geräte-/Browser-Klassen. Weitere Informationen in der{' '}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/90 underline underline-offset-2 hover:text-white transition-colors"
              >
                Datenschutzerklärung von Vercel
              </a>
              .
            </p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Affiliate-Kooperationen (in Prüfung)</h3>
            <p>
              Wir prüfen derzeit Affiliate-Kooperationen mit Ticket-Vendorn. Sobald eine solche
              Kooperation live geht, kann beim Klick auf externe Ticket-Buttons ein
              Tracking-Parameter (z.&nbsp;B. eine pseudonyme Click-ID) an den jeweiligen Vendor
              übermittelt werden, damit die Vermittlung nachvollzogen werden kann und wir eine
              Provision erhalten. Diese Verarbeitung erfolgt auf Grundlage berechtigten Interesses
              (Art. 6 Abs. 1 lit. f DSGVO) an der Finanzierung der Plattform. Die Ticketabwicklung
              selbst läuft vollständig beim jeweiligen Vendor. Die konkret eingesetzten Partner und
              Tracking-Netzwerke werden hier ergänzt, sobald eine Kooperation tatsächlich aktiv ist.
            </p>
          </section>

          {/* 7. Datenweitergabe */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Datenweitergabe an Dritte</h2>
            <p>
              Eine Weitergabe Ihrer personenbezogenen Daten an Dritte erfolgt nur, wenn dies zur
              Vertragserfüllung erforderlich ist, Sie ausdrücklich eingewilligt haben oder wir gesetzlich
              dazu verpflichtet sind. Eine Übermittlung in Drittländer außerhalb der EU/des EWR findet nur
              statt, wenn angemessene Garantien gemäß Art. 44 ff. DSGVO vorliegen.
            </p>
          </section>

          {/* 8. Speicherdauer */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Speicherdauer</h2>
            <p>
              Ihre personenbezogenen Daten werden nur so lange gespeichert, wie es für die jeweiligen
              Verarbeitungszwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li><span className="text-white/90">Kontodaten:</span> Bis zur Löschung Ihres Benutzerkontos</li>
              <li><span className="text-white/90">Nutzungsdaten:</span> Maximal 26 Monate (anonymisiert nach 14 Monaten)</li>
              <li><span className="text-white/90">Technische Logs:</span> Maximal 90 Tage</li>
              <li><span className="text-white/90">Erstellte Inhalte:</span> Bis zur Löschung durch den Nutzer oder Kontolöschung</li>
            </ul>
            <p className="mt-3">
              Nach Löschung Ihres Kontos werden Ihre Daten innerhalb von 30 Tagen vollständig aus
              unseren Systemen entfernt, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
            </p>
          </section>

          {/* 9. Betroffenenrechte */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Ihre Rechte als betroffene Person</h2>
            <p>Gemäß der DSGVO stehen Ihnen folgende Rechte zu:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li><span className="text-white/90">Auskunftsrecht (Art. 15 DSGVO):</span> Sie haben das Recht, Auskunft über die von uns gespeicherten personenbezogenen Daten zu verlangen.</li>
              <li><span className="text-white/90">Recht auf Berichtigung (Art. 16 DSGVO):</span> Sie können die Berichtigung unrichtiger oder die Vervollständigung unvollständiger Daten verlangen.</li>
              <li><span className="text-white/90">Recht auf Löschung (Art. 17 DSGVO):</span> Sie können die Löschung Ihrer gespeicherten personenbezogenen Daten verlangen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</li>
              <li><span className="text-white/90">Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO):</span> Sie können die Einschränkung der Verarbeitung Ihrer Daten verlangen.</li>
              <li><span className="text-white/90">Recht auf Datenportabilität (Art. 20 DSGVO):</span> Sie haben das Recht, Ihre Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten.</li>
              <li><span className="text-white/90">Widerspruchsrecht (Art. 21 DSGVO):</span> Sie können der Verarbeitung Ihrer Daten jederzeit widersprechen, wenn die Verarbeitung auf berechtigtem Interesse basiert.</li>
              <li><span className="text-white/90">Recht auf Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO):</span> Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen.</li>
            </ul>
          </section>

          {/* 10. Beschwerderecht */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Recht auf Beschwerde bei einer Aufsichtsbehörde</h2>
            <p>
              Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer personenbezogenen Daten gegen die DSGVO
              verstößt, haben Sie das Recht, Beschwerde bei einer Aufsichtsbehörde einzulegen. Die zuständige
              Aufsichtsbehörde in Österreich ist:
            </p>
            <p className="mt-3">
              Österreichische Datenschutzbehörde<br />
              Barichgasse 40-42<br />
              1030 Wien<br />
              Telefon: +43 1 52 152-0<br />
              E-Mail: dsb@dsb.gv.at<br />
              Website:{' '}
              <a
                href="https://www.dsb.gv.at"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/90 underline underline-offset-2 hover:text-white transition-colors"
              >
                www.dsb.gv.at
              </a>
            </p>
          </section>

          {/* 11. Kontakt */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Kontakt für Datenschutzanfragen</h2>
            <p>
              Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich bitte an:
            </p>
            <p className="mt-2">
              Jonathan Glatz<br />
              E-Mail:{' '}
              <a href="mailto:dev@glatzdev.com" className="text-white/90 underline underline-offset-2 hover:text-white transition-colors">
                dev@glatzdev.com
              </a>
            </p>
            <p className="mt-2">
              Wir werden Ihre Anfrage schnellstmöglich, spätestens jedoch innerhalb eines Monats, beantworten.
            </p>
          </section>

          {/* Last updated */}
          <p className="text-white/30 text-sm pt-8 border-t border-white/10">
            Zuletzt aktualisiert: 22. April 2026
          </p>
        </div>
      </div>
    </div>
  );
}
