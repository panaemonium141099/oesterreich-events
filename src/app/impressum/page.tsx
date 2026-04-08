{/* [Vom Anwalt prüfen lassen] */}

import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 86400; // ISR: revalidate every 24 hours

export const metadata: Metadata = {
  title: 'Impressum — Österreich Events',
  description: 'Impressum und rechtliche Angaben zu Österreich Events.',
};

export default function ImpressumPage() {
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

        <h1 className="text-3xl md:text-4xl font-bold mb-8">Impressum</h1>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Angaben gemäß § 5 E-Commerce-Gesetz (ECG)
            </h2>
            <p>
              Jonathan Glatz<br />
              Kreuzgasse 7<br />
              7061 Trausdorf an der Wulka<br />
              Österreich
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Kontakt</h2>
            <p>
              E-Mail:{' '}
              <a href="mailto:dev@glatzdev.com" className="text-white/90 underline underline-offset-2 hover:text-white transition-colors">
                dev@glatzdev.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Verantwortlich für den Inhalt
            </h2>
            <p>Jonathan Glatz</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Haftungsausschluss</h2>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Haftung für Inhalte</h3>
            <p>
              Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt. Für die Richtigkeit,
              Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als
              Diensteanbieter sind wir gemäß § 7 Abs. 1 ECG für eigene Inhalte auf diesen Seiten nach den
              allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 ECG sind wir als Diensteanbieter jedoch
              nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach
              Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Haftung für Links</h3>
            <p>
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss
              haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte
              der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
              Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
              Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente
              inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer
              Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige
              Links umgehend entfernen.
            </p>

            <h3 className="text-base font-medium text-white/90 mt-4 mb-2">Urheberrecht</h3>
            <p>
              Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem
              österreichischen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
              Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
              jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten,
              nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber
              erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter
              als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam
              werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen
              werden wir derartige Inhalte umgehend entfernen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Datenquellen & Lizenzen</h2>
            <p>
              Veranstaltungsdaten werden aus über 140 öffentlich zugänglichen Quellen aggregiert,
              darunter Open Data (CC BY 4.0), offizielle Tourismus-APIs und öffentliche
              Veranstaltungskalender. Eine vollständige Übersicht finden Sie auf unserer{' '}
              <Link
                href="/quellen"
                className="text-white/90 underline underline-offset-2 hover:text-white transition-colors"
              >
                Datenquellen & Lizenzen
              </Link>{' '}
              Seite.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Streitbeilegung</h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/90 underline underline-offset-2 hover:text-white transition-colors break-all"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p className="mt-2">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
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
